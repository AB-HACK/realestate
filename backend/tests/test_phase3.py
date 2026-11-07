import base64
import json
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, install_append_only_audit_triggers
from app.main import (
    admin_check_agent_registration,
    assign_inspector,
    get_admin_trust_overview,
    rate_completed_inspection,
    report_suspicious_listing,
    request_inspection,
    respond_to_payment_receipt,
    start_inspection_on_site,
    submit_agent_verification_profile,
    submit_inspection_report,
    upload_payment_receipt,
    validate_upload_size_and_mime,
)
from app.models import Plot
from app.schemas import (
    AgentAdminCheckRequest,
    AgentProfileSubmitRequest,
    ConditionItemInput,
    InspectionAssignRequest,
    InspectionMediaItem,
    InspectionRateRequest,
    InspectionRequestCreate,
    InspectionStartRequest,
    InspectionSubmitReportRequest,
    PaymentReceiptConfirmDisputeRequest,
    PaymentReceiptCreateRequest,
    SuspiciousReportCreateRequest,
)
from app.services.audit import verify_audit_chain
from app.services.geometry import (
    compute_price_benchmark,
    geodesic_distance_m,
    make_rectangle_near,
)


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    install_append_only_audit_triggers(engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSession()

    # Seed one plot in Ibadan (7.3800 N, 3.9000 E)
    coords = make_rectangle_near(7.3800, 3.9000, width_east_m=30.0, height_north_m=20.0)
    verts = [{"lat": lat, "lon": lon, "accuracy_m": 2.0} for (lon, lat) in coords]
    plot = Plot(
        id="plot-ibadan-p3",
        owner_id="u-owner",
        title="Phase 3 Test Plot at Bodija",
        description="Test plot for Phase 3 inspector geofence",
        state="Oyo",
        lga="Ibadan North",
        area_name="Bodija",
        purpose="sale",
        asking_price=36_000_000.0,
        currency="NGN",
        sqm_per_plot=600.0,
        measurement_method="gps_walk",
        polygon_geojson=json.dumps({"type": "Polygon", "coordinates": [coords]}),
        vertices_json=json.dumps(verts),
        centroid_lat=7.3801,
        centroid_lon=3.9001,
        public_fuzzed_lat=7.3825,
        public_fuzzed_lon=3.9025,
        is_occupied_home=False,
        mean_accuracy_m=2.0,
        computed_area_m2=600.0,
        area_low_m2=550.0,
        area_high_m2=650.0,
        computed_perimeter_m=100.0,
        status="published",
    )
    session.add(plot)
    session.commit()
    try:
        yield session
    finally:
        session.close()


def test_d1_inspector_100m_geofence_and_immutable_audit_report(db_session):
    """
    D1 Acceptance Test:
    - Buyer requests inspection -> Admin assigns inspector ->
    - Inspector attempting to start at ~250 m away is BLOCKED (> 100 m geofence).
    - Inspector starting within 100 m succeeds, submits checklist + timestamped in-app media,
      and generates an immutable audit event hash.
    - Buyer rates the completed inspection (1-5 stars).
    """
    buyer = {"id": "u-buyer-diaspora", "role": "buyer_renter"}
    admin = {"id": "u-admin", "role": "admin"}
    inspector = {"id": "u-inspector-1", "role": "inspector"}

    job_res = request_inspection(
        InspectionRequestCreate(
            target_type="plot",
            target_id="plot-ibadan-p3",
            requester_note="Diaspora buyer in London requesting beacon & road access check.",
            is_diaspora_requester=True,
        ),
        actor=buyer,
        db=db_session,
    )
    job_id = job_res["id"]
    assert job_res["status"] == "requested"

    assign_res = assign_inspector(
        job_id=job_id,
        req=InspectionAssignRequest(inspector_id="u-inspector-1"),
        actor=admin,
        db=db_session,
    )
    assert assign_res["status"] == "assigned"

    # Attempt to start ~350 m away (7.3832 N, 3.9001 E is ~344 m north of 7.3800 N)
    far_lat, far_lon = 7.3832, 3.9001
    assert geodesic_distance_m(7.3801, 3.9001, far_lat, far_lon) > 100.0

    with pytest.raises(HTTPException) as exc_info:
        start_inspection_on_site(
            job_id=job_id,
            req=InspectionStartRequest(inspector_lat=far_lat, inspector_lon=far_lon),
            actor=inspector,
            db=db_session,
        )
    assert exc_info.value.status_code == 400
    assert "exceeds the 100.0 m on-site start geofence" in str(exc_info.value.detail)

    # Start on-site ~15 m from the plot (7.38005 N, 3.90005 E)
    start_res = start_inspection_on_site(
        job_id=job_id,
        req=InspectionStartRequest(inspector_lat=7.38005, inspector_lon=3.90005),
        actor=inspector,
        db=db_session,
    )
    assert start_res["status"] == "in_progress"
    assert start_res["within_start_geofence"] is True
    assert start_res["distance_to_target_m"] <= 100.0

    # Submit inspection report -> immutable audit event
    sub_res = submit_inspection_report(
        job_id=job_id,
        req=InspectionSubmitReportRequest(
            report_summary="All four survey beacons inspected on-site. Dry laterite soil, tarred access road.",
            checklist_items=[
                ConditionItemInput(category="fence_gate", rating="good", notes="Block perimeter wall intact"),
                ConditionItemInput(category="access_road", rating="good", notes="Tarred estate road"),
                ConditionItemInput(category="drainage_flooding", rating="good", notes="Concrete side drains clear"),
            ],
            media=[
                InspectionMediaItem(
                    media_type="photo",
                    capture_source="in_app",
                    captured_at="2026-11-06T09:15:00Z",
                    lat=7.38005,
                    lon=3.90005,
                    sha256_hash="a" * 64,
                )
            ],
        ),
        actor=inspector,
        db=db_session,
    )
    assert sub_res["status"] == "completed"
    assert len(sub_res["immutable_audit_hash"]) == 64

    # Attempting to overwrite/re-submit a completed report is rejected
    with pytest.raises(HTTPException) as re_exc:
        submit_inspection_report(
            job_id=job_id,
            req=InspectionSubmitReportRequest(
                report_summary="Second attempt",
                checklist_items=[],
                media=[],
            ),
            actor=inspector,
            db=db_session,
        )
    assert re_exc.value.status_code == 400

    # Rate completed inspection
    rate_res = rate_completed_inspection(
        job_id=job_id,
        req=InspectionRateRequest(rating=5, review_comment="Clear beacon photos and accurate drainage notes."),
        actor=buyer,
        db=db_session,
    )
    assert rate_res["buyer_rating"] == 5

    chain = verify_audit_chain(db_session)
    assert chain["valid"] is True


def test_d2_agent_verification_exact_badge_and_no_self_approval(db_session):
    """
    D2 Acceptance Test:
    - Agent submits regulator (LASRERA), registration number, and ID document.
    - Agent attempting to call admin check endpoint on themselves is blocked (HTTP 403).
    - Admin manually checks register and records date -> badge states exactly:
      "Registration number checked by admin on <date>".
    """
    agent = {"id": "u-agent-lagos", "role": "agent"}
    admin = {"id": "u-admin", "role": "admin"}

    sample_pdf_b64 = base64.b64encode(b"%PDF-1.4 sample agent id card").decode("ascii")
    prof = submit_agent_verification_profile(
        AgentProfileSubmitRequest(
            registration_body="LASRERA",
            registration_number="LASRERA/AG/2026/0912",
            id_document_filename="lasrera_card.pdf",
            id_document_mime_type="application/pdf",
            id_document_base64=sample_pdf_b64,
        ),
        actor=agent,
        db=db_session,
    )
    assert prof["status"] == "uploaded"
    assert "pending admin check" in prof["badge_text"]

    # Agent cannot verify themselves
    with pytest.raises(HTTPException) as self_exc:
        admin_check_agent_registration(
            agent_id="u-agent-lagos",
            req=AgentAdminCheckRequest(
                outcome="checked_ok",
                checked_on_date="2026-11-06",
                admin_notes="Self-approval attempt",
            ),
            actor=agent,
            db=db_session,
        )
    assert self_exc.value.status_code == 403

    # Admin records manual register check
    checked = admin_check_agent_registration(
        agent_id="u-agent-lagos",
        req=AgentAdminCheckRequest(
            outcome="checked_ok",
            checked_on_date="2026-11-06",
            admin_notes="Checked against LASRERA public portal register.",
        ),
        actor=admin,
        db=db_session,
    )
    assert checked["status"] == "reviewed_by_admin"
    assert checked["badge_text"] == "Registration number checked by admin on 2026-11-06"
    assert "verified" not in checked["badge_text"].lower()


def test_d3_price_benchmarking_min_8_comps_and_p5_p95_outlier():
    """
    D3 Acceptance Test:
    - Fewer than 8 comparable listings -> returns `status == 'insufficient_data'`.
    - 8 or more comparable listings -> computes P5–P95 percentile band, Q1–Q3, median,
      and flags extreme outliers outside P5–P95 as indicative only.
    """
    # 1. Fewer than 8 comps (only 4 comps)
    few_comps = [
        {
            "id": f"comp-{i}",
            "title": f"Bodija Plot {i}",
            "type": "plot",
            "state": "Oyo",
            "lga": "Ibadan North",
            "lat": 7.3810 + i * 0.001,
            "lon": 3.9010,
            "area_m2": 600.0,
            "price_ngn": 36_000_000.0,
        }
        for i in range(4)
    ]
    res_insufficient = compute_price_benchmark(
        target_id="target-1",
        target_type="plot",
        target_price_ngn=36_000_000.0,
        target_area_m2=600.0,
        target_lat=7.3800,
        target_lon=3.9000,
        target_state="Oyo",
        target_lga="Ibadan North",
        candidates=few_comps,
        radius_km=3.0,
    )
    assert res_insufficient["status"] == "insufficient_data"
    assert "Insufficient data" in res_insufficient["status_label"]
    assert res_insufficient["percentile_band"] is None

    # 2. 10 comparable listings around 60,000 - 80,000 NGN/m²
    prices_per_m2 = [55_000, 60_000, 62_000, 65_000, 68_000, 70_000, 72_000, 75_000, 78_000, 82_000]
    ten_comps = [
        {
            "id": f"comp-ok-{i}",
            "title": f"Bodija Comparable {i}",
            "type": "plot",
            "state": "Oyo",
            "lga": "Ibadan North",
            "lat": 7.3805 + i * 0.0008,
            "lon": 3.9005,
            "area_m2": 600.0,
            "price_ngn": ppm2 * 600.0,
        }
        for i, ppm2 in enumerate(prices_per_m2)
    ]

    # Normal listing at 69,000 NGN/m² (41.4M NGN for 600 m²)
    res_normal = compute_price_benchmark(
        target_id="target-normal",
        target_type="plot",
        target_price_ngn=69_000.0 * 600.0,
        target_area_m2=600.0,
        target_lat=7.3800,
        target_lon=3.9000,
        target_state="Oyo",
        target_lga="Ibadan North",
        candidates=ten_comps,
        radius_km=3.0,
    )
    assert res_normal["status"] == "ok"
    assert res_normal["comparable_count"] == 10
    assert res_normal["is_extreme_outlier"] is False
    assert res_normal["percentile_band"]["p5_ngn"] < 69_000.0 < res_normal["percentile_band"]["p95_ngn"]
    assert "Indicative only" in res_normal["label"]

    # Extreme high outlier at 190,000 NGN/m² (> P95)
    res_outlier = compute_price_benchmark(
        target_id="target-outlier",
        target_type="plot",
        target_price_ngn=190_000.0 * 600.0,
        target_area_m2=600.0,
        target_lat=7.3800,
        target_lon=3.9000,
        target_state="Oyo",
        target_lga="Ibadan North",
        candidates=ten_comps,
        radius_km=3.0,
    )
    assert res_outlier["status"] == "ok"
    assert res_outlier["is_extreme_outlier"] is True
    assert res_outlier["outlier_direction"] == "above_p95"


def test_d4_d5_d6_payment_receipt_trail_suspicious_reports_and_upload_validation(db_session):
    """
    D4, D5 & D6 Acceptance Test:
    - Buyer uploads deposit receipt -> Seller confirms or disputes -> logged in audit chain.
    - User submits suspicious listing report -> appears in Admin Trust Overview queue.
    - Upload size/type validation rejects disallowed MIME types.
    """
    buyer = {"id": "u-buyer", "role": "buyer_renter"}
    owner = {"id": "u-owner", "role": "owner"}
    admin = {"id": "u-admin", "role": "admin"}

    receipt_res = upload_payment_receipt(
        PaymentReceiptCreateRequest(
            target_type="plot",
            target_id="plot-ibadan-p3",
            stage="deposit",
            amount=5_000_000.0,
            currency="NGN",
            payment_date="2026-11-06",
            payment_method="bank_transfer",
            bank_reference="NIP-GTB-20261106-99412",
            payer_name="Ngozi Eze",
            payee_name="Chidinma Okafor",
        ),
        actor=buyer,
        db=db_session,
    )
    assert receipt_res["buyer_status"] == "confirmed"
    assert receipt_res["seller_status"] == "pending"

    confirm_res = respond_to_payment_receipt(
        receipt_id=receipt_res["id"],
        req=PaymentReceiptConfirmDisputeRequest(
            party_role="seller",
            decision="confirmed",
            notes="Credit alert received in Zenith Bank account.",
        ),
        actor=owner,
        db=db_session,
    )
    assert confirm_res["buyer_status"] == "confirmed"
    assert confirm_res["seller_status"] == "confirmed"

    # D6: Suspicious listing report
    rep_res = report_suspicious_listing(
        SuspiciousReportCreateRequest(
            target_type="plot",
            target_id="plot-ibadan-p3",
            reason_category="unverified_agent_deposit_request",
            description="Someone claiming to represent the owner requested an inspection fee to a personal account.",
        ),
        actor=buyer,
        db=db_session,
    )
    assert rep_res["status"] == "open"

    # D6: Upload MIME validation rejects executable/script uploads
    with pytest.raises(HTTPException) as mime_exc:
        validate_upload_size_and_mime(b"#!/bin/sh", "application/x-sh")
    assert mime_exc.value.status_code == 400

    # D5: Admin trust overview reflects open suspicious report and intact audit chain
    overview = get_admin_trust_overview(actor=admin, db=db_session)
    assert overview["queues"]["open_suspicious_reports"] == 1
    assert overview["audit_chain"]["valid"] is True

