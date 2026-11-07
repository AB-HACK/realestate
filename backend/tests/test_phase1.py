import base64
import io
import os
import sys
import pytest
from PIL import Image, ImageDraw
from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from app.config import settings
from app.database import Base, install_append_only_audit_triggers
from app.main import (
    admin_update_document_status,
    create_plot,
    get_plot_detail,
    require_roles,
    upload_plot_document,
    upload_plot_photo,
    verify_audit_log_endpoint,
)
from app.schemas import (
    DocumentBase64UploadRequest,
    DocumentStatusUpdateRequest,
    PhotoBase64UploadRequest,
    PlotCreateRequest,
    VertexInput,
)
from app.services.audit import append_audit_event
from app.services.geometry import (
    GEOD,
    compute_polygon_metrics,
    convert_area_units,
    detect_spatial_conflicts,
    filter_and_aggregate_gps_samples,
    geodesic_area_and_perimeter,
    make_rectangle_near,
)


@pytest.fixture()
def test_db():
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine, future=True)

    Base.metadata.create_all(bind=test_engine)
    install_append_only_audit_triggers(test_engine)

    db = TestingSessionLocal()
    try:
        yield db, test_engine
    finally:
        db.close()
        test_engine.dispose()


def test_acceptance_ibadan_30x20_rectangle_and_unit_conversions():
    """
    PART B ACCEPTANCE:
    A 30 m x 20 m rectangle near Ibadan (about 7.38 N, 3.90 E) computes to 600 m² within 0.5%.
    Hectare, acre, and configurable plot conversions are accurate.
    """
    coords_lon_lat = make_rectangle_near(7.38, 3.90, 30.0, 20.0)
    area_m2, perimeter_m = geodesic_area_and_perimeter(coords_lon_lat)

    # Verify within 0.5% of 600 m² (i.e., 597.0 <= area_m2 <= 603.0)
    relative_error = abs(area_m2 - 600.0) / 600.0
    assert relative_error <= 0.005, f"Expected 600 m² ± 0.5%, got {area_m2:.4f} m²"
    assert abs(perimeter_m - 100.0) <= 0.5

    # Verify unit conversions with configurable sqm_per_plot (e.g. 500 m² and 648 m²)
    units_500 = convert_area_units(600.0, sqm_per_plot=500.0)
    assert units_500["m2"] == 600.0
    assert units_500["hectares"] == pytest.approx(0.06, rel=1e-6)
    assert units_500["acres"] == pytest.approx(600.0 / 4046.8564224, rel=1e-5)
    assert units_500["plots"] == pytest.approx(1.2, rel=1e-5)

    units_648 = convert_area_units(648.0, sqm_per_plot=648.0)
    assert units_648["plots"] == pytest.approx(1.0, rel=1e-5)

    # Verify uncertainty range buffering (area_low_m2 < computed_area_m2 < area_high_m2)
    vertices = [{"lat": lat, "lon": lon, "accuracy_m": 2.5} for (lon, lat) in coords_lon_lat]
    metrics = compute_polygon_metrics(
        vertices=vertices,
        sqm_per_plot=600.0,
        measurement_method="gps_walk",
    )
    assert metrics["area_low_m2"] < metrics["computed_area_m2"] < metrics["area_high_m2"]
    assert metrics["disclaimer"] == settings.MEASUREMENT_DISCLAIMER


def test_gps_boundary_walk_sample_filtering():
    """
    B2: Discard GPS samples with accuracy worse than 15 m, store median position and mean accuracy.
    """
    samples = [
        {"lat": 7.3801, "lon": 3.9001, "accuracy_m": 4.0},
        {"lat": 7.3802, "lon": 3.9002, "accuracy_m": 6.0},
        {"lat": 7.3803, "lon": 3.9003, "accuracy_m": 5.0},
        {"lat": 7.3999, "lon": 3.9999, "accuracy_m": 24.5},  # > 15m outlier must be discarded
    ]
    agg = filter_and_aggregate_gps_samples(samples, max_accuracy_m=15.0)
    assert agg["kept_samples"] == 3
    assert agg["discarded_samples"] == 1
    assert agg["lat"] == pytest.approx(7.3802, abs=1e-6)
    assert agg["lon"] == pytest.approx(3.9002, abs=1e-6)
    assert agg["accuracy_m"] == pytest.approx(5.0, abs=1e-2)


def test_acceptance_overlap_vs_shared_border_and_duplicate_detection():
    """
    PART B5 ACCEPTANCE:
    - Known overlap (>= 10% of smaller polygon) flags 'possible_overlap'.
    - Plots that only share a border do NOT flag 'possible_overlap'.
    - Plots with centroids within 30 m and areas within 10% flag 'possible_duplicate'.
    - Wording is never 'fraud'.
    """
    plot_a_coords = make_rectangle_near(7.3800, 3.9000, 30.0, 20.0)
    existing = [
        {
            "id": "plot-a",
            "title": "Plot A Bodija",
            "coords_lon_lat": plot_a_coords,
            "mean_accuracy_m": 2.0,
            "computed_area_m2": 600.0,
        }
    ]

    # Case 1: Plot B shares the exact eastern border of Plot A (starts 30m east of Plot A's origin, width 30m x 20m)
    east_origin_lon, east_origin_lat = plot_a_coords[1]
    shared_border_coords = make_rectangle_near(east_origin_lat, east_origin_lon, 30.0, 20.0)
    border_flags = detect_spatial_conflicts(
        candidate_id="plot-border-neighbor",
        candidate_coords_lon_lat=shared_border_coords,
        candidate_accuracy_m=2.0,
        existing_plots=existing,
    )
    overlap_on_shared_border = [f for f in border_flags if f["flag_type"] == "possible_overlap"]
    assert len(overlap_on_shared_border) == 0, "Plots that only share a border must NOT flag possible_overlap!"

    # Case 2: Plot C overlaps 50% of Plot A (shifted 15m east instead of 30m)
    mid_lon, mid_lat, _ = GEOD.fwd(3.9000, 7.3800, 90.0, 15.0)
    overlapping_coords = make_rectangle_near(mid_lat, mid_lon, 30.0, 20.0)
    overlap_flags = detect_spatial_conflicts(
        candidate_id="plot-overlapping",
        candidate_coords_lon_lat=overlapping_coords,
        candidate_accuracy_m=2.0,
        existing_plots=existing,
    )
    flag_types = [f["flag_type"] for f in overlap_flags]
    assert "possible_overlap" in flag_types
    assert "possible_duplicate" in flag_types
    for f in overlap_flags:
        assert "fraud" not in f["public_summary"].lower()
        assert "fraud" not in f["admin_detail"].lower()


def test_acceptance_audit_chain_tamper_detection(test_db):
    """
    PART B8 ACCEPTANCE:
    - Append-only DB triggers block direct SQL UPDATE and DELETE.
    - If an attacker bypasses triggers (e.g., drops trigger and alters a row),
      /api/v1/audit/verify recomputes the SHA-256 chain and reports the exact first mismatch.
    """
    db, test_engine = test_db
    admin_actor = {"id": "u-admin", "role": "admin"}

    append_audit_event(
        db,
        entity_type="plot",
        entity_id="p-101",
        event_type="plot.created",
        payload={"area_m2": 600.0},
        actor_id="u-owner",
        actor_role="owner",
    )
    append_audit_event(
        db,
        entity_type="document",
        entity_id="d-202",
        event_type="document.uploaded",
        payload={"status": "uploaded"},
        actor_id="u-owner",
        actor_role="owner",
    )
    db.commit()

    # 1. Verify chain passes initially
    data = verify_audit_log_endpoint(actor=admin_actor, db=db)
    assert data["valid"] is True
    assert data["total_events"] == 2
    assert data["first_mismatch_seq"] is None

    # 2. Verify DB trigger blocks normal SQL UPDATE on audit_events
    with pytest.raises(Exception):
        db.execute(text("UPDATE audit_events SET payload_json = :p WHERE seq = 1"), {"p": '{"area_m2":9999}'})
        db.commit()
    db.rollback()

    # 3. Simulate low-level DB file tampering by dropping trigger and altering row seq = 1
    db.execute(text("DROP TRIGGER IF EXISTS trg_audit_events_no_update"))
    db.execute(text("UPDATE audit_events SET payload_json = :p WHERE seq = 1"), {"p": '{"area_m2":9999}'})
    db.commit()

    # 4. Verify /api/v1/audit/verify detects the tampering at seq = 1
    tampered_data = verify_audit_log_endpoint(actor=admin_actor, db=db)
    assert tampered_data["valid"] is False
    assert tampered_data["first_mismatch_seq"] == 1


def test_rbac_document_status_rules_and_photo_reuse_and_ndpa_fuzzing(test_db):
    """
    Verify Part A & B rules end-to-end:
    - Owners cannot promote their own document status.
    - 'verified' alone is rejected; 'externally_verified' requires an external_report_id.
    - Reused photo across listings is flagged via SHA-256 / pHash.
    - Occupied homes fuzz coordinates by ~300 m for public visitors.
    """
    db, _ = test_db
    owner1_actor = {"id": "u-owner-1", "role": "owner"}
    owner2_actor = {"id": "u-owner-2", "role": "owner"}
    visitor_actor = {"id": "anon", "role": "visitor"}
    admin_actor = {"id": "u-admin", "role": "admin"}

    coords_1 = make_rectangle_near(7.3800, 3.9000, 30.0, 20.0)
    plot1 = create_plot(
        req=PlotCreateRequest(
            title="Plot 1 Ibadan",
            description="First test plot in Ibadan",
            state="Oyo",
            lga="Ibadan North",
            area_name="Bodija",
            purpose="sale",
            asking_price=25000000,
            currency="NGN",
            sqm_per_plot=600.0,
            measurement_method="gps_walk",
            is_occupied_home=True,
            vertices=[VertexInput(lat=lat, lon=lon, accuracy_m=2.0) for (lon, lat) in coords_1],
        ),
        actor=owner1_actor,
        db=db,
    )
    plot1_id = plot1["id"]

    # Visitor sees fuzzed coordinates (~300m away) and no exact polygon for occupied home
    visitor_view = get_plot_detail(plot_id=plot1_id, actor=visitor_actor, db=db)
    assert visitor_view["location_fuzzed_for_privacy"] is True
    assert visitor_view["polygon_geojson"] is None
    assert (visitor_view["centroid_lat"], visitor_view["centroid_lon"]) != (
        plot1["centroid_lat"],
        plot1["centroid_lon"],
    )

    # Upload surveyor plan with 25% area discrepancy -> auto-flags area_discrepancy
    raw_pdf_b64 = base64.b64encode(b"%PDF-1.4 sample survey plan content").decode("ascii")
    updated_plot1 = upload_plot_document(
        plot_id=plot1_id,
        req=DocumentBase64UploadRequest(
            category="survey_plan",
            title="Survey Plan OY/123",
            filename="survey.pdf",
            mime_type="application/pdf",
            file_base64=raw_pdf_b64,
            plan_number="OY/123",
            surveyor_name="Surv. Test",
            surveyor_reg_no="SURCON-999",
            stated_area_m2=800.0,  # > 15% diff from 600 m²
        ),
        actor=owner1_actor,
        db=db,
    )
    assert any(f["flag_type"] == "area_discrepancy" for f in updated_plot1["flags"])

    survey_doc_id = next(
        d["id"]
        for d in updated_plot1["evidence_completeness"]["document_checklist_summary"]["items"]
        if d["category"] == "survey_plan"
    )

    # Owner cannot promote their own document status (403 Forbidden via require_roles("admin"))
    admin_guard = require_roles("admin")
    with pytest.raises(HTTPException) as exc_role:
        admin_guard(actor=owner1_actor)
    assert exc_role.value.status_code == 403

    # Admin cannot set prohibited status 'verified' (400 Bad Request)
    with pytest.raises(HTTPException) as exc_bad_status:
        admin_update_document_status(
            doc_id=survey_doc_id,
            req=DocumentStatusUpdateRequest(status="verified"),
            actor=admin_actor,
            db=db,
        )
    assert exc_bad_status.value.status_code == 400

    # Admin cannot set 'externally_verified' without external_report_id (400 Bad Request)
    with pytest.raises(HTTPException) as exc_no_ext:
        admin_update_document_status(
            doc_id=survey_doc_id,
            req=DocumentStatusUpdateRequest(status="externally_verified"),
            actor=admin_actor,
            db=db,
        )
    assert exc_no_ext.value.status_code == 400

    # Admin can set 'externally_verified' when external_report_id is provided
    ext_ok = admin_update_document_status(
        doc_id=survey_doc_id,
        req=DocumentStatusUpdateRequest(
            status="externally_verified",
            external_report_id="ext-rep-oyo-registry-001",
            admin_notes="Confirmed against Oyo State Surveyor-General registry search report.",
        ),
        actor=admin_actor,
        db=db,
    )
    updated_doc = next(
        d
        for d in ext_ok["evidence_completeness"]["document_checklist_summary"]["items"]
        if d["id"] == survey_doc_id
    )
    assert updated_doc["status"] == "externally_verified"

    # Test photo reuse across two plots
    img = Image.new("RGB", (64, 64), color=(40, 120, 80))
    draw = ImageDraw.Draw(img)
    draw.rectangle([10, 10, 50, 50], fill=(220, 180, 40))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    img_b64 = base64.b64encode(buf.getvalue()).decode("ascii")

    # Upload photo to Plot 1
    upload_plot_photo(
        plot_id=plot1_id,
        req=PhotoBase64UploadRequest(
            capture_source="in_app",
            filename="corner1.jpg",
            image_base64=img_b64,
            lat=7.38005,
            lon=3.90005,
            gps_accuracy_m=3.2,
        ),
        actor=owner1_actor,
        db=db,
    )

    # Create Plot 2 far away and upload the SAME photo -> flags reused_image
    coords_2 = make_rectangle_near(7.4000, 3.9200, 30.0, 20.0)
    plot2 = create_plot(
        req=PlotCreateRequest(
            title="Plot 2 Ibadan",
            description="Second test plot in Ibadan",
            state="Oyo",
            lga="Ibadan North",
            area_name="Agodi",
            purpose="sale",
            asking_price=30000000,
            currency="NGN",
            sqm_per_plot=600.0,
            measurement_method="satellite_trace",
            vertices=[VertexInput(lat=lat, lon=lon, accuracy_m=3.5) for (lon, lat) in coords_2],
        ),
        actor=owner2_actor,
        db=db,
    )
    plot2_id = plot2["id"]

    p2_data = upload_plot_photo(
        plot_id=plot2_id,
        req=PhotoBase64UploadRequest(
            capture_source="uploaded",
            filename="reused.jpg",
            image_base64=img_b64,
            lat=7.40005,
            lon=3.92005,
            gps_accuracy_m=4.0,
        ),
        actor=owner2_actor,
        db=db,
    )
    assert p2_data["photos"][0]["is_reused_across_listings"] is True
    assert any(f["flag_type"] == "reused_image" for f in p2_data["flags"])
