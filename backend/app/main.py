import base64
import json
from typing import Any, Dict, List, Optional, Tuple

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import Base, SessionLocal, engine, get_db, install_append_only_audit_triggers
from app.models import (
    ALLOWED_EVIDENCE_STATUSES,
    ALLOWED_ROLES,
    AgentAuthorization,
    AgentVerificationRecord,
    AuditEvent,
    Building,
    BuildingPhoto,
    ConditionChecklist,
    ConflictingListingClaim,
    ConsentRecord,
    DocumentChecklistItem,
    EvidencePhoto,
    InspectionJob,
    MonitoringEntry,
    OwnershipClaimEvent,
    Plot,
    ProofOfPaymentReceipt,
    PropertyUnit,
    RoomDimension,
    SpatialFlag,
    SuspiciousListingReport,
    UnitListing,
    User,
    utcnow_iso,
)
from app.schemas import (
    AgentAdminCheckRequest,
    AgentAuthorizeRequest,
    AgentProfileSubmitRequest,
    BuildingCreateRequest,
    ConditionChecklistCreateRequest,
    DocumentBase64UploadRequest,
    DocumentStatusUpdateRequest,
    FlagReviewRequest,
    GeometryPreviewRequest,
    GpsCornerAggregateRequest,
    InspectionAssignRequest,
    InspectionRateRequest,
    InspectionRequestCreate,
    InspectionStartRequest,
    InspectionSubmitReportRequest,
    MonitoringEntryCreateRequest,
    OwnershipClaimCreateRequest,
    PaymentReceiptConfirmDisputeRequest,
    PaymentReceiptCreateRequest,
    PhotoBase64UploadRequest,
    PlotCreateRequest,
    SuspiciousReportCreateRequest,
    UnitListingCreateRequest,
)
from app.services.audit import append_audit_event, verify_audit_chain
from app.services.geometry import (
    check_footprint_inside_plot,
    compute_fuzzed_coordinates,
    compute_polygon_metrics,
    compute_price_benchmark,
    convert_area_units,
    detect_spatial_conflicts,
    distance_point_to_polygon_m,
    evaluate_room_areas_vs_declared,
    filter_and_aggregate_gps_samples,
    geodesic_distance_m,
    make_rectangle_near,
    verify_inspector_start_geofence,
)
from app.services.media import (
    compute_perceptual_hash,
    compute_sha256_bytes,
    create_signed_access_token,
    phash_hamming_distance,
    read_from_private_vault,
    save_to_private_vault,
    verify_signed_access_token,
)

app = FastAPI(
    title="AecrenEstates Evidence-First Property Platform API",
    version="1.0.0-phase1",
    description=(
        "Evidence-first Nigerian land & property registry API with WGS84 geodesic calculations, "
        "spatial overlap/duplicate index, in-app geotagged photo verification, private document vault, "
        "and tamper-evident SHA-256 audit hash chain."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


STANDARD_DOC_CATEGORIES = [
    ("survey_plan", "Registered Surveyor's Plan"),
    ("title_document", "Title Document (C of O / Registered Deed)"),
    ("governors_consent", "Governor's Consent / Gazette"),
    ("deed_of_assignment", "Deed of Assignment / Purchase Receipt"),
    ("other", "Other Supporting Evidence"),
]


def init_and_seed_db():
    """Initialize tables, install append-only audit triggers, and seed initial Nigerian demo data if empty."""
    Base.metadata.create_all(bind=engine)
    install_append_only_audit_triggers(engine)

    with SessionLocal() as db:
        existing_user = db.execute(select(User).limit(1)).scalar_one_or_none()
        if existing_user is not None:
            return

        # Seed users across the 6 RBAC roles
        seed_users = [
            User(
                id="u-admin",
                email="admin@aecrenestates.com",
                password_hash="demo",
                first_name="Adebayo",
                last_name="Ogunlesi",
                phone="+234 803 555 0100",
                role="admin",
            ),
            User(
                id="u-owner",
                email="owner@aecrenestates.com",
                password_hash="demo",
                first_name="Chidinma",
                last_name="Okafor",
                phone="+234 802 555 0101",
                role="owner",
            ),
            User(
                id="u-agent",
                email="agent@aecrenestates.com",
                password_hash="demo",
                first_name="Tunde",
                last_name="Bakare",
                phone="+234 805 555 0102",
                role="agent",
                agent_regulator="LASRERA",
                agent_reg_number="LASRERA/AG/2025/0419",
                agent_checked_at="2026-10-15",
                agent_checked_by_admin=True,
            ),
            User(
                id="u-inspector",
                email="inspector@aecrenestates.com",
                password_hash="demo",
                first_name="Ibrahim",
                last_name="Danjuma",
                phone="+234 809 555 0103",
                role="inspector",
            ),
            User(
                id="u-buyer",
                email="buyer@aecrenestates.com",
                password_hash="demo",
                first_name="Ngozi",
                last_name="Eze",
                phone="+234 818 555 0104",
                role="buyer_renter",
            ),
        ]
        for u in seed_users:
            db.add(u)
            db.add(
                ConsentRecord(
                    user_id=u.id,
                    purpose="NDPA 2023 Account & Geolocation Evidence Processing",
                )
            )
        db.flush()

        append_audit_event(
            db,
            entity_type="system",
            entity_id="seed-init",
            event_type="system.initialized",
            payload={"roles_seeded": len(seed_users), "compliance": "NDPA-2023"},
            actor_id="u-admin",
            actor_role="admin",
        )

        # Seed Plot 1: Ibadan Bodija 30m x 20m (~600 m²) via GPS Walk
        ibadan_coords = make_rectangle_near(7.3800, 3.9000, 30.0, 20.0)
        ibadan_vertices = [
            {"lat": lat, "lon": lon, "accuracy_m": 2.4, "kept_samples": 9}
            for (lon, lat) in ibadan_coords
        ]
        m1 = compute_polygon_metrics(
            vertices=ibadan_vertices,
            sqm_per_plot=600.0,
            measurement_method="gps_walk",
            declared_area_m2=600.0,
        )
        f_lat1, f_lon1 = compute_fuzzed_coordinates(
            "plot-ibadan-1", m1["centroid_lat"], m1["centroid_lon"]
        )
        p1 = Plot(
            id="plot-ibadan-1",
            owner_id="u-owner",
            title="Corner Residential Plot at Old Bodija Estate",
            description=(
                "Dry, level residential plot fenced on two sides with beacons visible at all four corners. "
                "Walked on-site with high-accuracy GPS corner sampling."
            ),
            state="Oyo",
            lga="Ibadan North",
            area_name="Old Bodija",
            purpose="sale",
            asking_price=45_000_000.0,
            currency="NGN",
            declared_area_m2=600.0,
            sqm_per_plot=600.0,
            measurement_method="gps_walk",
            polygon_geojson=json.dumps(m1["polygon_geojson"]),
            vertices_json=json.dumps(ibadan_vertices),
            centroid_lat=m1["centroid_lat"],
            centroid_lon=m1["centroid_lon"],
            public_fuzzed_lat=f_lat1,
            public_fuzzed_lon=f_lon1,
            is_occupied_home=False,
            mean_accuracy_m=m1["mean_accuracy_m"],
            computed_area_m2=m1["computed_area_m2"],
            area_low_m2=m1["area_low_m2"],
            area_high_m2=m1["area_high_m2"],
            computed_perimeter_m=m1["computed_perimeter_m"],
            status="published",
        )
        db.add(p1)
        for cat, label in STANDARD_DOC_CATEGORIES:
            st = "reviewed_by_admin" if cat in ("survey_plan", "title_document") else "uploaded" if cat == "deed_of_assignment" else "not_provided"
            db.add(
                DocumentChecklistItem(
                    plot_id=p1.id,
                    uploader_id="u-owner" if st != "not_provided" else None,
                    category=cat,
                    title=label,
                    status=st,
                    plan_number="OY/IBN/2024/882" if cat == "survey_plan" else None,
                    surveyor_name="Surv. Kunle Adeyemi" if cat == "survey_plan" else None,
                    surveyor_reg_no="SURCON-3912" if cat == "survey_plan" else None,
                    stated_area_m2=600.0 if cat == "survey_plan" else None,
                    area_diff_pct=0.0 if cat == "survey_plan" else None,
                    reviewed_by_admin_id="u-admin" if st == "reviewed_by_admin" else None,
                    admin_notes="Beacon numbers and perimeter bearings match submitted plan." if st == "reviewed_by_admin" else None,
                )
            )
        append_audit_event(
            db,
            entity_type="plot",
            entity_id=p1.id,
            event_type="plot.created",
            payload={
                "title": p1.title,
                "measurement_method": p1.measurement_method,
                "computed_area_m2": p1.computed_area_m2,
                "area_low_m2": p1.area_low_m2,
                "area_high_m2": p1.area_high_m2,
                "sqm_per_plot": p1.sqm_per_plot,
            },
            actor_id="u-owner",
            actor_role="owner",
        )

        # Seed Plot 2: Lekki Phase 1 (Lagos) 36m x 18m (~648 m²) via Satellite Trace
        lekki_coords = make_rectangle_near(6.4474, 3.4723, 36.0, 18.0)
        lekki_vertices = [
            {"lat": lat, "lon": lon, "accuracy_m": 3.5, "kept_samples": 1}
            for (lon, lat) in lekki_coords
        ]
        m2 = compute_polygon_metrics(
            vertices=lekki_vertices,
            sqm_per_plot=648.0,
            measurement_method="satellite_trace",
            declared_area_m2=648.0,
        )
        f_lat2, f_lon2 = compute_fuzzed_coordinates(
            "plot-lekki-1", m2["centroid_lat"], m2["centroid_lon"]
        )
        p2 = Plot(
            id="plot-lekki-1",
            owner_id="u-agent",
            title="Fenced Commercial/Mixed-Use Plot in Lekki Phase 1",
            description=(
                "Strategically positioned plot off Admiralty Way traced from satellite imagery. "
                "Surveyor plan uploaded and currently under admin review."
            ),
            state="Lagos",
            lga="Eti-Osa",
            area_name="Lekki Phase 1",
            purpose="construction",
            asking_price=185_000_000.0,
            currency="NGN",
            declared_area_m2=648.0,
            sqm_per_plot=648.0,
            measurement_method="satellite_trace",
            polygon_geojson=json.dumps(m2["polygon_geojson"]),
            vertices_json=json.dumps(lekki_vertices),
            centroid_lat=m2["centroid_lat"],
            centroid_lon=m2["centroid_lon"],
            public_fuzzed_lat=f_lat2,
            public_fuzzed_lon=f_lon2,
            is_occupied_home=True,
            mean_accuracy_m=m2["mean_accuracy_m"],
            computed_area_m2=m2["computed_area_m2"],
            area_low_m2=m2["area_low_m2"],
            area_high_m2=m2["area_high_m2"],
            computed_perimeter_m=m2["computed_perimeter_m"],
            status="under_review",
        )
        db.add(p2)
        for cat, label in STANDARD_DOC_CATEGORIES:
            st = "under_review" if cat in ("survey_plan", "governors_consent") else "not_provided"
            db.add(
                DocumentChecklistItem(
                    plot_id=p2.id,
                    uploader_id="u-agent" if st != "not_provided" else None,
                    category=cat,
                    title=label,
                    status=st,
                    plan_number="LS/ET/2025/114" if cat == "survey_plan" else None,
                    surveyor_name="Surv. Bisi Balogun" if cat == "survey_plan" else None,
                    surveyor_reg_no="SURCON-4108" if cat == "survey_plan" else None,
                    stated_area_m2=648.0 if cat == "survey_plan" else None,
                )
            )
        append_audit_event(
            db,
            entity_type="plot",
            entity_id=p2.id,
            event_type="plot.created",
            payload={
                "title": p2.title,
                "measurement_method": p2.measurement_method,
                "computed_area_m2": p2.computed_area_m2,
                "sqm_per_plot": p2.sqm_per_plot,
            },
            actor_id="u-agent",
            actor_role="agent",
        )
        db.commit()


init_and_seed_db()


def get_actor(
    x_actor_id: Optional[str] = Header(default="visitor"),
    x_actor_role: Optional[str] = Header(default="visitor"),
) -> Dict[str, str]:
    role = (x_actor_role or "visitor").strip().lower()
    if role not in ALLOWED_ROLES:
        raise HTTPException(status_code=403, detail=f"Invalid role '{role}'. Allowed roles: {ALLOWED_ROLES}")
    return {"id": x_actor_id or "visitor", "role": role}


def require_roles(*allowed_roles: str):
    def dependency(actor: Dict[str, str] = Depends(get_actor)) -> Dict[str, str]:
        if actor["role"] not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Role '{actor['role']}' is not authorised for this endpoint. Required: {allowed_roles}",
            )
        return actor

    return dependency


def build_evidence_completeness(
    db: Session,
    plot: Plot,
    owner: Optional[User],
) -> Dict[str, Any]:
    """
    B9: Construct the itemised Public Evidence Completeness Panel.
    Never returns a single 'verified' badge.
    """
    photos = db.execute(select(EvidencePhoto).where(EvidencePhoto.plot_id == plot.id)).scalars().all()
    docs = (
        db.execute(select(DocumentChecklistItem).where(DocumentChecklistItem.plot_id == plot.id))
        .scalars()
        .all()
    )
    flags = (
        db.execute(
            select(SpatialFlag).where(
                SpatialFlag.plot_id == plot.id,
                SpatialFlag.status == "open",
            )
        )
        .scalars()
        .all()
    )

    in_app_geofenced_count = sum(
        1 for p in photos if p.capture_source == "in_app" and p.within_geofence and not p.is_reused_across_listings
    )
    uploaded_photo_count = sum(1 for p in photos if p.capture_source == "uploaded")

    doc_status_counts: Dict[str, int] = {st: 0 for st in ALLOWED_EVIDENCE_STATUSES}
    for d in docs:
        doc_status_counts[d.status] = doc_status_counts.get(d.status, 0) + 1

    overlap_flags = [f for f in flags if f.flag_type in ("possible_overlap", "possible_duplicate")]
    other_flags = [f for f in flags if f.flag_type not in ("possible_overlap", "possible_duplicate")]

    agent_status = "Owner-listed (Direct)"
    if owner and owner.role == "agent":
        if owner.agent_checked_by_admin and owner.agent_checked_at:
            agent_status = (
                f"Registration number ({owner.agent_regulator}: {owner.agent_reg_number}) "
                f"checked by admin on {owner.agent_checked_at}"
            )
        elif owner.agent_reg_number:
            agent_status = f"Agent registration declared ({owner.agent_regulator}: {owner.agent_reg_number}) — pending admin check"
        else:
            agent_status = "Agent registration not provided"

    return {
        "boundary_evidence": {
            "measurement_method": plot.measurement_method,
            "confidence_label": (
                "Field GPS Walk"
                if plot.measurement_method == "gps_walk"
                else "Surveyor Plan Digitisation"
                if plot.measurement_method == "surveyor_plan"
                else "Satellite Imagery Trace (Lower Confidence)"
            ),
            "mean_vertex_accuracy_m": plot.mean_accuracy_m,
            "computed_area_m2": plot.computed_area_m2,
            "area_uncertainty_range_m2": [plot.area_low_m2, plot.area_high_m2],
            "disclaimer": settings.MEASUREMENT_DISCLAIMER,
        },
        "photo_evidence": {
            "in_app_geofenced_count": in_app_geofenced_count,
            "required_minimum": settings.MIN_IN_APP_PHOTOS,
            "uploaded_count": uploaded_photo_count,
            "meets_minimum_in_app_threshold": in_app_geofenced_count >= settings.MIN_IN_APP_PHOTOS,
            "gps_spoofing_notice": "GPS metadata is a signal, not cryptographic proof of physical presence.",
        },
        "document_checklist_summary": {
            "counts_by_status": doc_status_counts,
            "items": [
                {
                    "id": d.id,
                    "category": d.category,
                    "title": d.title,
                    "status": d.status,
                    "plan_number": d.plan_number,
                    "surveyor_name": d.surveyor_name,
                    "surveyor_reg_no": d.surveyor_reg_no,
                    "stated_area_m2": d.stated_area_m2,
                    "area_diff_pct": d.area_diff_pct,
                    "admin_notes": d.admin_notes,
                }
                for d in docs
            ],
        },
        "spatial_conflict_status": {
            "has_open_overlap_or_duplicate": len(overlap_flags) > 0,
            "open_conflict_count": len(overlap_flags),
            "public_notice": (
                "May overlap or duplicate another listing; an admin will review."
                if overlap_flags
                else "No spatial overlap or duplicate flags currently open."
            ),
            "other_open_warnings_count": len(other_flags),
        },
        "lister_status": {
            "role": owner.role if owner else "owner",
            "agent_verification_statement": agent_status,
        },
    }


def serialize_plot(
    db: Session,
    plot: Plot,
    actor: Dict[str, str],
) -> Dict[str, Any]:
    owner = db.execute(select(User).where(User.id == plot.owner_id)).scalar_one_or_none()
    is_privileged = (
        actor["role"] in ("admin", "inspector")
        or actor["id"] == plot.owner_id
    )

    # NDPA 2023 Rule #7: Public visitors/buyers only see ~300 m fuzzed location for occupied homes
    hide_exact_location = bool(plot.is_occupied_home and not is_privileged)

    vertices = json.loads(plot.vertices_json)
    polygon_geojson = json.loads(plot.polygon_geojson)
    flags = db.execute(select(SpatialFlag).where(SpatialFlag.plot_id == plot.id)).scalars().all()
    photos = db.execute(select(EvidencePhoto).where(EvidencePhoto.plot_id == plot.id)).scalars().all()

    return {
        "id": plot.id,
        "owner_id": plot.owner_id,
        "owner_name": f"{owner.first_name} {owner.last_name}" if owner else "Plot Owner",
        "title": plot.title,
        "description": plot.description,
        "state": plot.state,
        "lga": plot.lga,
        "area_name": plot.area_name,
        "purpose": plot.purpose,
        "asking_price": plot.asking_price,
        "currency": plot.currency,
        "declared_area_m2": plot.declared_area_m2,
        "sqm_per_plot": plot.sqm_per_plot,
        "measurement_method": plot.measurement_method,
        "mean_accuracy_m": plot.mean_accuracy_m,
        "computed_area_m2": plot.computed_area_m2,
        "area_low_m2": plot.area_low_m2,
        "area_high_m2": plot.area_high_m2,
        "computed_perimeter_m": plot.computed_perimeter_m,
        "units": {
            "nominal": convert_area_units(plot.computed_area_m2, plot.sqm_per_plot),
            "low": convert_area_units(plot.area_low_m2, plot.sqm_per_plot),
            "high": convert_area_units(plot.area_high_m2, plot.sqm_per_plot),
        },
        "disclaimer": settings.MEASUREMENT_DISCLAIMER,
        "is_occupied_home": plot.is_occupied_home,
        "location_fuzzed_for_privacy": hide_exact_location,
        "fuzz_radius_m": settings.PUBLIC_FUZZ_RADIUS_M if hide_exact_location else 0.0,
        "centroid_lat": plot.public_fuzzed_lat if hide_exact_location else plot.centroid_lat,
        "centroid_lon": plot.public_fuzzed_lon if hide_exact_location else plot.centroid_lon,
        "polygon_geojson": None if hide_exact_location else polygon_geojson,
        "vertices": [] if hide_exact_location else vertices,
        "status": plot.status,
        "created_at": plot.created_at,
        "updated_at": plot.updated_at,
        "evidence_completeness": build_evidence_completeness(db, plot, owner),
        "photos": [
            {
                "id": ph.id,
                "capture_source": ph.capture_source,
                "badge": "captured in-app" if ph.capture_source == "in_app" else "uploaded",
                "filename": ph.filename,
                "sha256_hash": ph.sha256_hash,
                "phash_64": ph.phash_64,
                "gps_accuracy_m": ph.gps_accuracy_m,
                "distance_to_plot_m": ph.distance_to_plot_m,
                "within_geofence": ph.within_geofence,
                "is_reused_across_listings": ph.is_reused_across_listings,
                "client_captured_at": ph.client_captured_at,
                "server_received_at": ph.server_received_at,
            }
            for ph in photos
        ],
        "flags": [
            {
                "id": fl.id,
                "flag_type": fl.flag_type,
                "status": fl.status,
                "metric_value": fl.metric_value,
                "summary": fl.admin_detail if actor["role"] == "admin" else fl.public_summary,
                "conflicting_plot_id": fl.conflicting_plot_id if actor["role"] == "admin" else None,
                "admin_notes": fl.admin_notes if actor["role"] == "admin" else None,
                "created_at": fl.created_at,
            }
            for fl in flags
        ],
    }


@app.get("/api/v1/health")
def health_check():
    return {
        "status": "ok",
        "phase": "Phase 1 — Land Evidence (Part B)",
        "disclaimer": settings.MEASUREMENT_DISCLAIMER,
    }


@app.post("/api/v1/geometry/gps-corner")
def aggregate_gps_corner(req: GpsCornerAggregateRequest):
    """B2: Aggregate 10s watchPosition corner samples, discarding samples > 15m accuracy."""
    try:
        samples_dicts = [s.model_dump() for s in req.samples]
        result = filter_and_aggregate_gps_samples(samples_dicts, req.max_accuracy_m)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/v1/geometry/preview")
def preview_polygon_geometry(req: GeometryPreviewRequest):
    """B1–B3: Compute geodesic area, perimeter, uncertainty range, and unit conversions."""
    try:
        vertices_dicts = [v.model_dump() for v in req.vertices]
        metrics = compute_polygon_metrics(
            vertices=vertices_dicts,
            sqm_per_plot=req.sqm_per_plot,
            measurement_method=req.measurement_method,
            declared_area_m2=req.declared_area_m2,
        )
        return metrics
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/api/v1/plots")
def list_plots(
    state: Optional[str] = Query(default=None),
    purpose: Optional[str] = Query(default=None),
    measurement_method: Optional[str] = Query(default=None),
    actor: Dict[str, str] = Depends(get_actor),
    db: Session = Depends(get_db),
):
    stmt = select(Plot).order_by(Plot.created_at.desc())
    if state and state != "all":
        stmt = stmt.where(Plot.state == state)
    if purpose and purpose != "all":
        stmt = stmt.where(Plot.purpose == purpose)
    if measurement_method and measurement_method != "all":
        stmt = stmt.where(Plot.measurement_method == measurement_method)

    plots = db.execute(stmt).scalars().all()
    return [serialize_plot(db, p, actor) for p in plots]


@app.get("/api/v1/plots/{plot_id}")
def get_plot_detail(
    plot_id: str,
    actor: Dict[str, str] = Depends(get_actor),
    db: Session = Depends(get_db),
):
    plot = db.execute(select(Plot).where(Plot.id == plot_id)).scalar_one_or_none()
    if not plot:
        raise HTTPException(status_code=404, detail="Plot not found")
    return serialize_plot(db, plot, actor)


@app.post("/api/v1/plots", status_code=201)
def create_plot(
    req: PlotCreateRequest,
    actor: Dict[str, str] = Depends(require_roles("owner", "agent", "admin")),
    db: Session = Depends(get_db),
):
    """
    B1–B5: Create a new Plot with geodesic calculations, spatial index conflict check,
    initial document checklist, and tamper-evident audit logging.
    """
    try:
        vertices_dicts = [v.model_dump() for v in req.vertices]
        metrics = compute_polygon_metrics(
            vertices=vertices_dicts,
            sqm_per_plot=req.sqm_per_plot,
            measurement_method=req.measurement_method,
            declared_area_m2=req.declared_area_m2,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Load existing plots for STRtree spatial conflict detection
    existing_rows = db.execute(select(Plot)).scalars().all()
    existing_for_index: List[Dict[str, Any]] = []
    for row in existing_rows:
        verts = json.loads(row.vertices_json)
        coords_lon_lat: List[Tuple[float, float]] = [(float(v["lon"]), float(v["lat"])) for v in verts]
        existing_for_index.append(
            {
                "id": row.id,
                "title": row.title,
                "coords_lon_lat": coords_lon_lat,
                "mean_accuracy_m": row.mean_accuracy_m,
                "computed_area_m2": row.computed_area_m2,
            }
        )

    import uuid
    plot_id = f"plot-{uuid.uuid4().hex[:10]}"
    fuzzed_lat, fuzzed_lon = compute_fuzzed_coordinates(
        plot_id, metrics["centroid_lat"], metrics["centroid_lon"]
    )

    cand_coords = [(float(v.lon), float(v.lat)) for v in req.vertices]
    detected_conflicts = detect_spatial_conflicts(
        candidate_id=plot_id,
        candidate_coords_lon_lat=cand_coords,
        candidate_accuracy_m=metrics["mean_accuracy_m"],
        existing_plots=existing_for_index,
    )

    # Check declared vs measured area (> 15% discrepancy)
    area_discrepancy_pct = metrics.get("declared_vs_measured_diff_pct")
    has_area_discrepancy = (
        area_discrepancy_pct is not None
        and area_discrepancy_pct > settings.SURVEYOR_AREA_DIFF_THRESHOLD
    )

    initial_status = (
        "under_review" if (detected_conflicts or has_area_discrepancy) else "published"
    )

    new_plot = Plot(
        id=plot_id,
        owner_id=actor["id"],
        title=req.title.strip(),
        description=req.description.strip(),
        state=req.state.strip(),
        lga=req.lga.strip(),
        area_name=req.area_name.strip(),
        purpose=req.purpose,
        asking_price=req.asking_price,
        currency=req.currency,
        declared_area_m2=req.declared_area_m2,
        sqm_per_plot=req.sqm_per_plot,
        measurement_method=req.measurement_method,
        polygon_geojson=json.dumps(metrics["polygon_geojson"]),
        vertices_json=json.dumps(vertices_dicts),
        centroid_lat=metrics["centroid_lat"],
        centroid_lon=metrics["centroid_lon"],
        public_fuzzed_lat=fuzzed_lat,
        public_fuzzed_lon=fuzzed_lon,
        is_occupied_home=req.is_occupied_home,
        mean_accuracy_m=metrics["mean_accuracy_m"],
        computed_area_m2=metrics["computed_area_m2"],
        area_low_m2=metrics["area_low_m2"],
        area_high_m2=metrics["area_high_m2"],
        computed_perimeter_m=metrics["computed_perimeter_m"],
        status=initial_status,
    )
    db.add(new_plot)

    # Seed standard document checklist items (status = not_provided)
    for cat, label in STANDARD_DOC_CATEGORIES:
        db.add(
            DocumentChecklistItem(
                plot_id=plot_id,
                category=cat,
                title=label,
                status="not_provided",
            )
        )

    # Persist spatial conflict flags
    for c in detected_conflicts:
        db.add(
            SpatialFlag(
                plot_id=plot_id,
                conflicting_plot_id=c["conflicting_plot_id"],
                flag_type=c["flag_type"],
                severity="high",
                metric_value=c["metric_value"],
                public_summary=c["public_summary"],
                admin_detail=c["admin_detail"],
                status="open",
            )
        )

    if has_area_discrepancy and area_discrepancy_pct is not None:
        db.add(
            SpatialFlag(
                plot_id=plot_id,
                flag_type="area_discrepancy",
                severity="warning",
                metric_value=area_discrepancy_pct,
                public_summary="Declared area differs from measured polygon by more than 15%; routed for admin review.",
                admin_detail=(
                    f"Declared area ({req.declared_area_m2} m²) vs geodesic measured area "
                    f"({metrics['computed_area_m2']} m²) differs by {area_discrepancy_pct * 100:.1f}%."
                ),
                status="open",
            )
        )

    append_audit_event(
        db,
        entity_type="plot",
        entity_id=plot_id,
        event_type="plot.created",
        payload={
            "title": new_plot.title,
            "measurement_method": new_plot.measurement_method,
            "computed_area_m2": new_plot.computed_area_m2,
            "area_low_m2": new_plot.area_low_m2,
            "area_high_m2": new_plot.area_high_m2,
            "sqm_per_plot": new_plot.sqm_per_plot,
            "conflicts_detected": len(detected_conflicts),
        },
        actor_id=actor["id"],
        actor_role=actor["role"],
    )

    db.commit()
    db.refresh(new_plot)
    return serialize_plot(db, new_plot, actor)


@app.post("/api/v1/plots/{plot_id}/photos", status_code=201)
def upload_plot_photo(
    plot_id: str,
    req: PhotoBase64UploadRequest,
    actor: Dict[str, str] = Depends(require_roles("owner", "agent", "inspector", "admin")),
    db: Session = Depends(get_db),
):
    """
    B6: Record photo evidence (in-app vs uploaded), compute SHA-256 + perceptual hash,
    flag reused images across listings, and verify 50m polygon geofence.
    """
    plot = db.execute(select(Plot).where(Plot.id == plot_id)).scalar_one_or_none()
    if not plot:
        raise HTTPException(status_code=404, detail="Plot not found")

    try:
        encoded = req.image_base64.split(",")[-1]
        raw_bytes = base64.b64decode(encoded)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 image data")

    sha256_hex = compute_sha256_bytes(raw_bytes)
    phash_hex = compute_perceptual_hash(raw_bytes)

    # Check if image is reused across other listings (exact SHA-256 or pHash Hamming distance <= 6)
    other_photos = (
        db.execute(select(EvidencePhoto).where(EvidencePhoto.plot_id != plot_id)).scalars().all()
    )
    reused_from_plot_id: Optional[str] = None
    for existing_photo in other_photos:
        if existing_photo.sha256_hash == sha256_hex or (
            phash_hamming_distance(phash_hex, existing_photo.phash_64) <= settings.PHASH_HAMMING_THRESHOLD
        ):
            reused_from_plot_id = existing_photo.plot_id
            break

    # Compute distance from photo GPS to plot polygon
    verts = json.loads(plot.vertices_json)
    poly_coords = [(float(v["lon"]), float(v["lat"])) for v in verts]
    dist_m = distance_point_to_polygon_m(req.lat, req.lon, poly_coords)
    within_geofence = dist_m <= settings.PHOTO_GEOFENCE_MAX_DISTANCE_M

    storage_key = save_to_private_vault(raw_bytes, prefix=f"photo_{plot_id}", ext=".jpg")
    server_ts = utcnow_iso()

    photo = EvidencePhoto(
        plot_id=plot_id,
        uploader_id=actor["id"],
        capture_source=req.capture_source,
        private_storage_key=storage_key,
        filename=req.filename,
        mime_type=req.mime_type,
        sha256_hash=sha256_hex,
        phash_64=phash_hex,
        lat=req.lat,
        lon=req.lon,
        gps_accuracy_m=req.gps_accuracy_m,
        distance_to_plot_m=dist_m,
        within_geofence=within_geofence,
        is_reused_across_listings=reused_from_plot_id is not None,
        reused_from_plot_id=reused_from_plot_id,
        client_captured_at=req.client_captured_at or server_ts,
        server_received_at=server_ts,
    )
    db.add(photo)
    db.flush()

    if reused_from_plot_id is not None:
        db.add(
            SpatialFlag(
                plot_id=plot_id,
                conflicting_plot_id=reused_from_plot_id,
                flag_type="reused_image",
                severity="high",
                metric_value=1.0,
                public_summary="An uploaded photo matches an image used on another listing; queued for admin review.",
                admin_detail=(
                    f"Photo {photo.id} (SHA-256: {sha256_hex[:12]}..., pHash: {phash_hex}) "
                    f"matches an image already used on plot {reused_from_plot_id}."
                ),
                status="open",
            )
        )

    if not within_geofence:
        db.add(
            SpatialFlag(
                plot_id=plot_id,
                flag_type="photo_geofence_warning",
                severity="warning",
                metric_value=dist_m,
                public_summary=f"Photo captured {dist_m:.1f} m away from plot boundary (> {settings.PHOTO_GEOFENCE_MAX_DISTANCE_M} m threshold).",
                admin_detail=f"Photo {photo.id} GPS ({req.lat}, {req.lon}) is {dist_m:.1f} m from plot {plot_id}.",
                status="open",
            )
        )

    append_audit_event(
        db,
        entity_type="evidence_photo",
        entity_id=photo.id,
        event_type="photo.uploaded",
        payload={
            "plot_id": plot_id,
            "capture_source": photo.capture_source,
            "sha256_hash": photo.sha256_hash,
            "phash_64": photo.phash_64,
            "distance_to_plot_m": photo.distance_to_plot_m,
            "within_geofence": photo.within_geofence,
            "is_reused_across_listings": photo.is_reused_across_listings,
            "server_received_at": photo.server_received_at,
        },
        actor_id=actor["id"],
        actor_role=actor["role"],
    )

    db.commit()
    return serialize_plot(db, plot, actor)


@app.post("/api/v1/plots/{plot_id}/documents", status_code=201)
def upload_plot_document(
    plot_id: str,
    req: DocumentBase64UploadRequest,
    actor: Dict[str, str] = Depends(require_roles("owner", "agent", "admin")),
    db: Session = Depends(get_db),
):
    """
    B4 & B7: Upload a document into the private vault.
    - Sets status to 'uploaded' (owners cannot self-promote status).
    - If surveyor_plan has stated_area_m2 differing from plot.computed_area_m2 by > 15%, flags for admin review.
    """
    plot = db.execute(select(Plot).where(Plot.id == plot_id)).scalar_one_or_none()
    if not plot:
        raise HTTPException(status_code=404, detail="Plot not found")

    try:
        encoded = req.file_base64.split(",")[-1]
        raw_bytes = base64.b64decode(encoded)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 document payload")

    sha256_hex = compute_sha256_bytes(raw_bytes)
    ext = "." + req.filename.split(".")[-1] if "." in req.filename else ".pdf"
    storage_key = save_to_private_vault(raw_bytes, prefix=f"doc_{plot_id}_{req.category}", ext=ext)

    area_diff_pct: Optional[float] = None
    if req.stated_area_m2 and req.stated_area_m2 > 0:
        area_diff_pct = round(
            abs(plot.computed_area_m2 - req.stated_area_m2) / req.stated_area_m2, 4
        )

    # Find existing checklist slot or create new
    doc_item = (
        db.execute(
            select(DocumentChecklistItem).where(
                DocumentChecklistItem.plot_id == plot_id,
                DocumentChecklistItem.category == req.category,
            )
        )
        .scalars()
        .first()
    )

    if doc_item is None or req.category in ("other", "external_report"):
        doc_item = DocumentChecklistItem(
            plot_id=plot_id,
            uploader_id=actor["id"],
            category=req.category,
            title=req.title,
            private_storage_key=storage_key,
            filename=req.filename,
            mime_type=req.mime_type,
            sha256_hash=sha256_hex,
            status="uploaded",
            plan_number=req.plan_number,
            surveyor_name=req.surveyor_name,
            surveyor_reg_no=req.surveyor_reg_no,
            stated_area_m2=req.stated_area_m2,
            area_diff_pct=area_diff_pct,
        )
        db.add(doc_item)
        db.flush()
    else:
        doc_item.uploader_id = actor["id"]
        doc_item.title = req.title
        doc_item.private_storage_key = storage_key
        doc_item.filename = req.filename
        doc_item.mime_type = req.mime_type
        doc_item.sha256_hash = sha256_hex
        doc_item.status = "uploaded"
        doc_item.plan_number = req.plan_number
        doc_item.surveyor_name = req.surveyor_name
        doc_item.surveyor_reg_no = req.surveyor_reg_no
        doc_item.stated_area_m2 = req.stated_area_m2
        doc_item.area_diff_pct = area_diff_pct
        doc_item.updated_at = utcnow_iso()
        db.flush()

    # B4: Flag if stated area and measured area differ by > 15%
    if area_diff_pct is not None and area_diff_pct > settings.SURVEYOR_AREA_DIFF_THRESHOLD:
        plot.status = "under_review"
        db.add(
            SpatialFlag(
                plot_id=plot_id,
                flag_type="area_discrepancy",
                severity="high",
                metric_value=area_diff_pct,
                public_summary=(
                    f"Surveyor plan stated area ({req.stated_area_m2:.1f} m²) differs from "
                    f"measured polygon ({plot.computed_area_m2:.1f} m²) by {area_diff_pct * 100:.1f}% (> 15% threshold)."
                ),
                admin_detail=(
                    f"Surveyor plan {req.plan_number or 'N/A'} by {req.surveyor_name or 'N/A'} "
                    f"({req.surveyor_reg_no or 'N/A'}) states {req.stated_area_m2:.1f} m² vs "
                    f"measured {plot.computed_area_m2:.1f} m² ({area_diff_pct * 100:.1f}% difference)."
                ),
                status="open",
            )
        )

    append_audit_event(
        db,
        entity_type="document",
        entity_id=doc_item.id,
        event_type="document.uploaded",
        payload={
            "plot_id": plot_id,
            "category": doc_item.category,
            "sha256_hash": doc_item.sha256_hash,
            "status": doc_item.status,
            "plan_number": doc_item.plan_number,
            "stated_area_m2": doc_item.stated_area_m2,
            "area_diff_pct": doc_item.area_diff_pct,
        },
        actor_id=actor["id"],
        actor_role=actor["role"],
    )

    db.commit()
    return serialize_plot(db, plot, actor)


@app.patch("/api/v1/documents/{doc_id}/status")
def admin_update_document_status(
    doc_id: str,
    req: DocumentStatusUpdateRequest,
    actor: Dict[str, str] = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """
    Part A Rule #1 & B7: Only admin can promote document statuses.
    Allowed statuses: not_provided, uploaded, under_review, reviewed_by_admin, externally_verified.
    'externally_verified' requires an external_report_id to be attached.
    """
    if req.status not in ALLOWED_EVIDENCE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Status '{req.status}' is prohibited. Never label anything 'verified' alone. "
                f"Allowed statuses: {ALLOWED_EVIDENCE_STATUSES}"
            ),
        )

    doc = db.execute(select(DocumentChecklistItem).where(DocumentChecklistItem.id == doc_id)).scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document checklist item not found")

    if req.status == "externally_verified":
        ext_id = req.external_report_id or doc.external_report_id
        if not ext_id:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Cannot set status to 'externally_verified' without attaching an external report "
                    "(e.g. state registry search or licensed surveyor/solicitor verification report)."
                ),
            )
        doc.external_report_id = ext_id

    old_status = doc.status
    doc.status = req.status
    doc.reviewed_by_admin_id = actor["id"]
    if req.admin_notes is not None:
        doc.admin_notes = req.admin_notes
    doc.updated_at = utcnow_iso()

    append_audit_event(
        db,
        entity_type="document",
        entity_id=doc.id,
        event_type="document.status_changed",
        payload={
            "plot_id": doc.plot_id,
            "category": doc.category,
            "previous_status": old_status,
            "new_status": doc.status,
            "external_report_id": doc.external_report_id,
            "admin_notes": doc.admin_notes,
        },
        actor_id=actor["id"],
        actor_role=actor["role"],
    )

    db.commit()
    plot = db.execute(select(Plot).where(Plot.id == doc.plot_id)).scalar_one()
    return serialize_plot(db, plot, actor)


@app.post("/api/v1/private-access/sign")
def request_signed_private_url(
    resource_type: str = Query(..., pattern="^(document|photo)$"),
    resource_id: str = Query(...),
    actor: Dict[str, str] = Depends(require_roles("buyer_renter", "owner", "agent", "inspector", "admin")),
    db: Session = Depends(get_db),
):
    """Part A #6: Issue a short-lived HMAC-signed access URL for private documents/photos."""
    if resource_type == "document":
        item = db.execute(
            select(DocumentChecklistItem).where(DocumentChecklistItem.id == resource_id)
        ).scalar_one_or_none()
        if not item or not item.private_storage_key:
            raise HTTPException(status_code=404, detail="Private document file not found")
    else:
        item = db.execute(
            select(EvidencePhoto).where(EvidencePhoto.id == resource_id)
        ).scalar_one_or_none()
        if not item or not item.private_storage_key:
            raise HTTPException(status_code=404, detail="Private evidence photo not found")

    signed = create_signed_access_token(resource_type, resource_id, actor["id"])
    append_audit_event(
        db,
        entity_type=resource_type,
        entity_id=resource_id,
        event_type="private_vault.signed_access_issued",
        payload={"actor_id": actor["id"], "expires_at": signed["expires_at"]},
        actor_id=actor["id"],
        actor_role=actor["role"],
    )
    db.commit()
    return {
        "signed_url": f"/api/v1/private-access/{resource_type}/{resource_id}?token={signed['token']}",
        "expires_at": signed["expires_at"],
    }


@app.get("/api/v1/private-access/{resource_type}/{resource_id}")
def serve_private_vault_file(
    resource_type: str,
    resource_id: str,
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    valid, err = verify_signed_access_token(resource_type, resource_id, token)
    if not valid:
        raise HTTPException(status_code=403, detail=err or "Invalid signed token")

    if resource_type == "document":
        doc = db.execute(
            select(DocumentChecklistItem).where(DocumentChecklistItem.id == resource_id)
        ).scalar_one_or_none()
        if not doc or not doc.private_storage_key:
            raise HTTPException(status_code=404, detail="Document not found")
        raw = read_from_private_vault(doc.private_storage_key)
        return Response(content=raw, media_type=doc.mime_type or "application/pdf")
    elif resource_type == "photo":
        ph = db.execute(
            select(EvidencePhoto).where(EvidencePhoto.id == resource_id)
        ).scalar_one_or_none()
        if not ph or not ph.private_storage_key:
            raise HTTPException(status_code=404, detail="Photo not found")
        raw = read_from_private_vault(ph.private_storage_key)
        return Response(content=raw, media_type=ph.mime_type or "image/jpeg")

    raise HTTPException(status_code=400, detail="Unsupported resource type")


@app.get("/api/v1/admin/conflicts")
def admin_list_conflicts(
    actor: Dict[str, str] = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """
    B5: Admin review queue with side-by-side polygon geometries for overlapping/duplicate plots.
    """
    flags = db.execute(select(SpatialFlag).order_by(SpatialFlag.created_at.desc())).scalars().all()
    results = []
    for fl in flags:
        primary_plot = db.execute(select(Plot).where(Plot.id == fl.plot_id)).scalar_one_or_none()
        conflicting_plot = (
            db.execute(select(Plot).where(Plot.id == fl.conflicting_plot_id)).scalar_one_or_none()
            if fl.conflicting_plot_id
            else None
        )
        results.append(
            {
                "id": fl.id,
                "flag_type": fl.flag_type,
                "severity": fl.severity,
                "metric_value": fl.metric_value,
                "public_summary": fl.public_summary,
                "admin_detail": fl.admin_detail,
                "status": fl.status,
                "admin_notes": fl.admin_notes,
                "created_at": fl.created_at,
                "primary_plot": (
                    {
                        "id": primary_plot.id,
                        "title": primary_plot.title,
                        "owner_id": primary_plot.owner_id,
                        "computed_area_m2": primary_plot.computed_area_m2,
                        "mean_accuracy_m": primary_plot.mean_accuracy_m,
                        "centroid_lat": primary_plot.centroid_lat,
                        "centroid_lon": primary_plot.centroid_lon,
                        "polygon_geojson": json.loads(primary_plot.polygon_geojson),
                    }
                    if primary_plot
                    else None
                ),
                "conflicting_plot": (
                    {
                        "id": conflicting_plot.id,
                        "title": conflicting_plot.title,
                        "owner_id": conflicting_plot.owner_id,
                        "computed_area_m2": conflicting_plot.computed_area_m2,
                        "mean_accuracy_m": conflicting_plot.mean_accuracy_m,
                        "centroid_lat": conflicting_plot.centroid_lat,
                        "centroid_lon": conflicting_plot.centroid_lon,
                        "polygon_geojson": json.loads(conflicting_plot.polygon_geojson),
                    }
                    if conflicting_plot
                    else None
                ),
            }
        )
    return results


@app.patch("/api/v1/admin/flags/{flag_id}")
def admin_resolve_flag(
    flag_id: str,
    req: FlagReviewRequest,
    actor: Dict[str, str] = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    fl = db.execute(select(SpatialFlag).where(SpatialFlag.id == flag_id)).scalar_one_or_none()
    if not fl:
        raise HTTPException(status_code=404, detail="Flag not found")
    fl.status = req.status
    fl.admin_notes = req.admin_notes
    fl.reviewed_by_admin_id = actor["id"]

    append_audit_event(
        db,
        entity_type="spatial_flag",
        entity_id=fl.id,
        event_type="flag.status_changed",
        payload={
            "plot_id": fl.plot_id,
            "flag_type": fl.flag_type,
            "new_status": fl.status,
            "admin_notes": fl.admin_notes,
        },
        actor_id=actor["id"],
        actor_role=actor["role"],
    )
    db.commit()
    return {"id": fl.id, "status": fl.status, "admin_notes": fl.admin_notes}


@app.get("/api/v1/audit")
def list_audit_events(
    limit: int = Query(default=100, le=500),
    actor: Dict[str, str] = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    events = (
        db.execute(select(AuditEvent).order_by(AuditEvent.seq.desc()).limit(limit))
        .scalars()
        .all()
    )
    return [
        {
            "seq": ev.seq,
            "entity_type": ev.entity_type,
            "entity_id": ev.entity_id,
            "actor_id": ev.actor_id,
            "actor_role": ev.actor_role,
            "event_type": ev.event_type,
            "payload": json.loads(ev.payload_json),
            "created_at": ev.created_at,
            "prev_hash": ev.prev_hash,
            "hash": ev.hash,
        }
        for ev in events
    ]


@app.get("/api/v1/audit/verify")
def verify_audit_log_endpoint(
    actor: Dict[str, str] = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """
    B8: Admin endpoint /audit/verify recomputes the SHA-256 hash chain from genesis
    and reports the first mismatch.
    """
    return verify_audit_chain(db)


# ==============================================================================
# PART C (PHASE 2): BUILT HOUSES & APARTMENTS ENDPOINTS (C1 - C7)
# ==============================================================================


def serialize_building(db: Session, bld: Building, actor: Dict[str, str]) -> Dict[str, Any]:
    units = (
        db.execute(select(PropertyUnit).where(PropertyUnit.building_id == bld.id))
        .scalars()
        .all()
    )
    checklists = (
        db.execute(select(ConditionChecklist).where(ConditionChecklist.building_id == bld.id))
        .scalars()
        .all()
    )
    claims = (
        db.execute(select(OwnershipClaimEvent).where(OwnershipClaimEvent.building_id == bld.id))
        .scalars()
        .all()
    )
    monitoring = (
        db.execute(select(MonitoringEntry).where(MonitoringEntry.building_id == bld.id))
        .scalars()
        .all()
    )

    hide_exact = (
        bld.is_occupied_home
        and actor["role"] not in ("admin", "inspector")
        and actor["id"] != bld.owner_id
    )

    serialized_units = []
    for u in units:
        rooms = (
            db.execute(select(RoomDimension).where(RoomDimension.unit_id == u.id))
            .scalars()
            .all()
        )
        listings = (
            db.execute(select(UnitListing).where(UnitListing.unit_id == u.id))
            .scalars()
            .all()
        )
        conflicts = (
            db.execute(
                select(ConflictingListingClaim).where(ConflictingListingClaim.unit_id == u.id)
            )
            .scalars()
            .all()
        )
        serialized_units.append(
            {
                "id": u.id,
                "building_id": u.building_id,
                "unit_name": u.unit_name,
                "floor_number": u.floor_number,
                "bedrooms": u.bedrooms,
                "bathrooms": u.bathrooms,
                "power_meter_type": u.power_meter_type,
                "power_disco": u.power_disco,
                "water_source": u.water_source,
                "drainage_flood_notes": u.drainage_flood_notes,
                "security_features": u.security_features,
                "declared_area_m2": u.declared_area_m2,
                "computed_room_area_sum_m2": u.computed_room_area_sum_m2,
                "room_area_diff_pct": u.room_area_diff_pct,
                "room_area_discrepancy_flagged": u.room_area_discrepancy_flagged,
                "occupancy_status": u.occupancy_status,
                "lease_start_date": u.lease_start_date,
                "lease_end_date": u.lease_end_date,
                "rooms": [
                    {
                        "id": rm.id,
                        "room_name": rm.room_name,
                        "length_m": rm.length_m,
                        "width_m": rm.width_m,
                        "height_m": rm.height_m,
                        "computed_area_m2": rm.computed_area_m2,
                        "measurement_source": rm.measurement_source,
                    }
                    for rm in rooms
                ],
                "active_listings": [
                    {
                        "id": lst.id,
                        "lister_id": lst.lister_id,
                        "lister_role": lst.lister_role,
                        "listing_type": lst.listing_type,
                        "asking_price": lst.asking_price,
                        "currency": lst.currency,
                        "status": lst.status,
                        "is_primary_active": lst.is_primary_active,
                        "linked_owner_listing_id": lst.linked_owner_listing_id,
                    }
                    for lst in listings
                ],
                "conflicting_claims": [
                    {
                        "id": c.id,
                        "claimant_id": c.claimant_id if actor["role"] == "admin" else "withheld",
                        "reason": c.reason,
                        "status": c.status,
                    }
                    for c in conflicts
                ],
            }
        )

    return {
        "id": bld.id,
        "owner_id": bld.owner_id,
        "plot_id": bld.plot_id,
        "title": bld.title,
        "property_type": bld.property_type,
        "address": bld.address,
        "state": bld.state,
        "lga": bld.lga,
        "storeys": bld.storeys,
        "year_built": bld.year_built,
        "measurement_method": bld.measurement_method,
        "footprint_area_m2": bld.footprint_area_m2,
        "footprint_area_low_m2": bld.footprint_area_low_m2,
        "footprint_area_high_m2": bld.footprint_area_high_m2,
        "footprint_perimeter_m": bld.footprint_perimeter_m,
        "mean_accuracy_m": bld.mean_accuracy_m,
        "entrance_lat": bld.public_fuzzed_lat if hide_exact else bld.entrance_lat,
        "entrance_lon": bld.public_fuzzed_lon if hide_exact else bld.entrance_lon,
        "location_fuzzed_for_privacy": hide_exact,
        "footprint_inside_plot": bld.footprint_inside_plot,
        "footprint_outside_ratio": bld.footprint_outside_ratio,
        "reinspection_interval_days": bld.reinspection_interval_days,
        "next_reinspection_due_at": bld.next_reinspection_due_at,
        "disclaimer": settings.MEASUREMENT_DISCLAIMER,
        "units": serialized_units,
        "checklists": [
            {
                "id": chk.id,
                "unit_id": chk.unit_id,
                "declaration_label": chk.declaration_label,
                "items": json.loads(chk.items_json),
                "created_at": chk.created_at,
            }
            for chk in checklists
        ],
        "ownership_claims": [
            {
                "id": cl.id,
                "claim_type": cl.claim_type,
                "summary": cl.summary,
                "document_ref": cl.document_ref,
                "status": cl.status,
                "admin_notes": cl.admin_notes,
                "created_at": cl.created_at,
            }
            for cl in claims
        ],
        "monitoring_entries": [
            {
                "id": m.id,
                "entry_type": m.entry_type,
                "stage_label": m.stage_label,
                "notes": m.notes,
                "lat": m.lat,
                "lon": m.lon,
                "captured_at": m.captured_at,
            }
            for m in monitoring
        ],
    }


@app.post("/api/v1/buildings", status_code=201)
def create_building(
    req: BuildingCreateRequest,
    actor: Dict[str, str] = Depends(require_roles("owner", "agent", "admin")),
    db: Session = Depends(get_db),
):
    """
    C1 & C2: Create a Building with footprint polygon, check containment inside linked Plot polygon,
    and create units with room dimension sum vs declared area check (>20% discrepancy flag).
    """
    vertices_dicts = [v.model_dump() for v in req.footprint_vertices]
    metrics = compute_polygon_metrics(
        vertices=vertices_dicts,
        sqm_per_plot=600.0,
        measurement_method=req.measurement_method,
    )

    footprint_inside = True
    outside_ratio = 0.0

    if req.plot_id:
        parent_plot = db.execute(select(Plot).where(Plot.id == req.plot_id)).scalar_one_or_none()
        if not parent_plot:
            raise HTTPException(status_code=404, detail="Linked parent plot not found")
        plot_verts = json.loads(parent_plot.vertices_json)
        plot_coords = [(float(v["lon"]), float(v["lat"])) for v in plot_verts]
        fp_coords = [(float(v.lon), float(v.lat)) for v in req.footprint_vertices]
        containment = check_footprint_inside_plot(fp_coords, plot_coords)
        footprint_inside = containment["footprint_inside_plot"]
        outside_ratio = containment["outside_ratio"]

    import uuid
    bld_id = f"bld-{uuid.uuid4().hex[:10]}"
    fuzzed_lat, fuzzed_lon = compute_fuzzed_coordinates(
        bld_id, req.entrance_lat, req.entrance_lon
    )

    new_bld = Building(
        id=bld_id,
        owner_id=actor["id"],
        plot_id=req.plot_id,
        title=req.title.strip(),
        property_type=req.property_type,
        address=req.address.strip(),
        state=req.state.strip(),
        lga=req.lga.strip(),
        storeys=req.storeys,
        year_built=req.year_built,
        measurement_method=req.measurement_method,
        footprint_geojson=json.dumps(metrics["polygon_geojson"]),
        footprint_vertices_json=json.dumps(vertices_dicts),
        footprint_area_m2=metrics["computed_area_m2"],
        footprint_area_low_m2=metrics["area_low_m2"],
        footprint_area_high_m2=metrics["area_high_m2"],
        footprint_perimeter_m=metrics["computed_perimeter_m"],
        mean_accuracy_m=metrics["mean_accuracy_m"],
        entrance_lat=req.entrance_lat,
        entrance_lon=req.entrance_lon,
        public_fuzzed_lat=fuzzed_lat,
        public_fuzzed_lon=fuzzed_lon,
        is_occupied_home=req.is_occupied_home,
        footprint_inside_plot=footprint_inside,
        footprint_outside_ratio=outside_ratio,
        reinspection_interval_days=req.reinspection_interval_days,
    )
    db.add(new_bld)
    db.flush()

    for unit_in in req.units:
        room_eval = evaluate_room_areas_vs_declared(
            [r.model_dump() for r in unit_in.rooms],
            unit_in.declared_area_m2,
        )
        unit_row = PropertyUnit(
            building_id=bld_id,
            unit_name=unit_in.unit_name,
            floor_number=unit_in.floor_number,
            bedrooms=unit_in.bedrooms,
            bathrooms=unit_in.bathrooms,
            power_meter_type=unit_in.power_meter_type,
            power_disco=unit_in.power_disco,
            water_source=unit_in.water_source,
            drainage_flood_notes=unit_in.drainage_flood_notes,
            security_features=unit_in.security_features,
            declared_area_m2=unit_in.declared_area_m2,
            computed_room_area_sum_m2=room_eval["computed_room_area_sum_m2"],
            room_area_diff_pct=room_eval["room_area_diff_pct"],
            room_area_discrepancy_flagged=room_eval["room_area_discrepancy_flagged"],
            occupancy_status=unit_in.occupancy_status,
            lease_start_date=unit_in.lease_start_date,
            lease_end_date=unit_in.lease_end_date,
        )
        db.add(unit_row)
        db.flush()

        for rm_data in room_eval["rooms"]:
            db.add(
                RoomDimension(
                    unit_id=unit_row.id,
                    room_name=rm_data["room_name"],
                    length_m=rm_data["length_m"],
                    width_m=rm_data["width_m"],
                    height_m=rm_data["height_m"],
                    computed_area_m2=rm_data["computed_area_m2"],
                    measurement_source=rm_data["measurement_source"],
                )
            )

    append_audit_event(
        db,
        entity_type="building",
        entity_id=bld_id,
        event_type="building.created",
        payload={
            "title": new_bld.title,
            "plot_id": new_bld.plot_id,
            "footprint_area_m2": new_bld.footprint_area_m2,
            "footprint_inside_plot": new_bld.footprint_inside_plot,
            "units_count": len(req.units),
        },
        actor_id=actor["id"],
        actor_role=actor["role"],
    )
    db.commit()
    return serialize_building(db, new_bld, actor)


@app.get("/api/v1/buildings")
def list_buildings(
    actor: Dict[str, str] = Depends(get_actor),
    db: Session = Depends(get_db),
):
    buildings = db.execute(select(Building).order_by(Building.created_at.desc())).scalars().all()
    return [serialize_building(db, b, actor) for b in buildings]


@app.post("/api/v1/buildings/{building_id}/checklists", status_code=201)
def create_condition_checklist(
    building_id: str,
    req: ConditionChecklistCreateRequest,
    actor: Dict[str, str] = Depends(require_roles("owner", "agent", "inspector", "admin")),
    db: Session = Depends(get_db),
):
    """
    C3: Condition checklist labelled 'self-declared' or 'inspected by <inspector>'.
    """
    bld = db.execute(select(Building).where(Building.id == building_id)).scalar_one_or_none()
    if not bld:
        raise HTTPException(status_code=404, detail="Building not found")

    user_row = db.execute(select(User).where(User.id == actor["id"])).scalar_one_or_none()
    actor_name = (
        f"{user_row.first_name} {user_row.last_name}" if user_row else actor["id"]
    )
    declaration_label = (
        f"inspected by {actor_name}"
        if actor["role"] == "inspector"
        else "self-declared"
    )

    items_list = [i.model_dump() for i in req.items]
    chk = ConditionChecklist(
        building_id=building_id,
        unit_id=req.unit_id,
        author_id=actor["id"],
        author_role=actor["role"],
        declaration_label=declaration_label,
        items_json=json.dumps(items_list),
    )
    db.add(chk)
    db.flush()

    append_audit_event(
        db,
        entity_type="condition_checklist",
        entity_id=chk.id,
        event_type="checklist.recorded",
        payload={
            "building_id": building_id,
            "declaration_label": declaration_label,
            "items_count": len(items_list),
        },
        actor_id=actor["id"],
        actor_role=actor["role"],
    )
    db.commit()
    return {
        "id": chk.id,
        "declaration_label": chk.declaration_label,
        "items": items_list,
    }


@app.post("/api/v1/units/{unit_id}/authorize-agent", status_code=201)
def authorize_agent_for_unit(
    unit_id: str,
    req: AgentAuthorizeRequest,
    actor: Dict[str, str] = Depends(require_roles("owner", "admin")),
    db: Session = Depends(get_db),
):
    """C5: Owner explicitly authorises an agent to market/list a unit."""
    unit = db.execute(select(PropertyUnit).where(PropertyUnit.id == unit_id)).scalar_one_or_none()
    if not unit:
        raise HTTPException(status_code=404, detail="Property unit not found")

    auth = AgentAuthorization(
        unit_id=unit_id,
        owner_id=actor["id"],
        agent_id=req.agent_id,
        status="active",
    )
    db.add(auth)
    db.flush()

    append_audit_event(
        db,
        entity_type="agent_authorization",
        entity_id=auth.id,
        event_type="unit.agent_authorized",
        payload={"unit_id": unit_id, "owner_id": actor["id"], "agent_id": req.agent_id},
        actor_id=actor["id"],
        actor_role=actor["role"],
    )
    db.commit()
    return {"id": auth.id, "unit_id": unit_id, "agent_id": req.agent_id, "status": auth.status}


@app.post("/api/v1/units/{unit_id}/listings", status_code=201)
def create_unit_listing(
    unit_id: str,
    req: UnitListingCreateRequest,
    actor: Dict[str, str] = Depends(require_roles("owner", "agent", "admin")),
    db: Session = Depends(get_db),
):
    """
    C5: One-active-listing rule per unit.
    - If no active primary listing exists, creates the active primary listing.
    - If an active primary listing already exists:
      - If the actor is an explicitly authorised agent for this unit, creates a linked co-listing (`is_primary_active=False`, `linked_owner_listing_id=...`).
      - Otherwise, the second attempt is BLOCKED and routed to Admin as a `ConflictingListingClaim` (HTTP 409).
    """
    unit = db.execute(select(PropertyUnit).where(PropertyUnit.id == unit_id)).scalar_one_or_none()
    if not unit:
        raise HTTPException(status_code=404, detail="Property unit not found")

    existing_active = (
        db.execute(
            select(UnitListing).where(
                UnitListing.unit_id == unit_id,
                UnitListing.status == "active",
                UnitListing.is_primary_active.is_(True),
            )
        )
        .scalars()
        .first()
    )

    if existing_active is not None:
        # Check if actor is an explicitly authorized agent
        auth_record = (
            db.execute(
                select(AgentAuthorization).where(
                    AgentAuthorization.unit_id == unit_id,
                    AgentAuthorization.agent_id == actor["id"],
                    AgentAuthorization.status == "active",
                )
            )
            .scalars()
            .first()
        )
        if auth_record is not None:
            linked_listing = UnitListing(
                unit_id=unit_id,
                building_id=unit.building_id,
                lister_id=actor["id"],
                lister_role=actor["role"],
                listing_type=req.listing_type,
                asking_price=req.asking_price,
                currency=req.currency,
                status="active",
                is_primary_active=False,
                linked_owner_listing_id=existing_active.id,
                authorization_id=auth_record.id,
            )
            db.add(linked_listing)
            db.flush()
            append_audit_event(
                db,
                entity_type="unit_listing",
                entity_id=linked_listing.id,
                event_type="unit_listing.authorized_agent_linked",
                payload={
                    "unit_id": unit_id,
                    "linked_owner_listing_id": existing_active.id,
                    "authorization_id": auth_record.id,
                },
                actor_id=actor["id"],
                actor_role=actor["role"],
            )
            db.commit()
            return {
                "id": linked_listing.id,
                "status": "active",
                "is_primary_active": False,
                "linked_owner_listing_id": existing_active.id,
            }

        # Unauthorized duplicate listing attempt -> Block and route to Admin as conflicting claim
        claim = ConflictingListingClaim(
            unit_id=unit_id,
            existing_listing_id=existing_active.id,
            claimant_id=actor["id"],
            claimant_role=actor["role"],
            attempted_price=req.asking_price,
            currency=req.currency,
            reason="Blocked second active listing attempt on unit; routed to Admin as conflicting claim.",
            status="open",
        )
        db.add(claim)
        db.flush()
        append_audit_event(
            db,
            entity_type="conflicting_listing_claim",
            entity_id=claim.id,
            event_type="unit_listing.conflict_blocked",
            payload={
                "unit_id": unit_id,
                "existing_listing_id": existing_active.id,
                "claimant_id": actor["id"],
            },
            actor_id=actor["id"],
            actor_role=actor["role"],
        )
        db.commit()
        raise HTTPException(
            status_code=409,
            detail={
                "error": "one_active_listing_rule_violation",
                "message": "This unit already has an active listing. Your attempt has been blocked and routed to an admin as a conflicting claim.",
                "conflicting_claim_id": claim.id,
            },
        )

    primary_listing = UnitListing(
        unit_id=unit_id,
        building_id=unit.building_id,
        lister_id=actor["id"],
        lister_role=actor["role"],
        listing_type=req.listing_type,
        asking_price=req.asking_price,
        currency=req.currency,
        status="active",
        is_primary_active=True,
    )
    db.add(primary_listing)
    db.flush()
    append_audit_event(
        db,
        entity_type="unit_listing",
        entity_id=primary_listing.id,
        event_type="unit_listing.created",
        payload={"unit_id": unit_id, "asking_price": req.asking_price, "currency": req.currency},
        actor_id=actor["id"],
        actor_role=actor["role"],
    )
    db.commit()
    return {
        "id": primary_listing.id,
        "status": primary_listing.status,
        "is_primary_active": primary_listing.is_primary_active,
        "linked_owner_listing_id": None,
    }


@app.post("/api/v1/buildings/{building_id}/ownership-claims", status_code=201)
def create_ownership_claim(
    building_id: str,
    req: OwnershipClaimCreateRequest,
    actor: Dict[str, str] = Depends(require_roles("owner", "agent", "admin")),
    db: Session = Depends(get_db),
):
    """C6: Record ownership/status transfer claim with document reference in the audit chain."""
    claim = OwnershipClaimEvent(
        building_id=building_id,
        claimant_id=actor["id"],
        claim_type=req.claim_type,
        summary=req.summary,
        document_ref=req.document_ref,
        status="under_review",
    )
    db.add(claim)
    db.flush()
    append_audit_event(
        db,
        entity_type="ownership_claim",
        entity_id=claim.id,
        event_type="ownership_claim.submitted",
        payload={
            "building_id": building_id,
            "claim_type": req.claim_type,
            "document_ref": req.document_ref,
            "status": "under_review",
        },
        actor_id=actor["id"],
        actor_role=actor["role"],
    )
    db.commit()
    return {"id": claim.id, "status": claim.status, "summary": claim.summary}


@app.post("/api/v1/buildings/{building_id}/monitoring", status_code=201)
def create_monitoring_entry(
    building_id: str,
    req: MonitoringEntryCreateRequest,
    actor: Dict[str, str] = Depends(require_roles("owner", "agent", "inspector", "admin")),
    db: Session = Depends(get_db),
):
    """C7: Add dated, geotagged construction or maintenance timeline entry linking plot -> building."""
    bld = db.execute(select(Building).where(Building.id == building_id)).scalar_one_or_none()
    if not bld:
        raise HTTPException(status_code=404, detail="Building not found")

    entry = MonitoringEntry(
        plot_id=bld.plot_id,
        building_id=building_id,
        author_id=actor["id"],
        entry_type=req.entry_type,
        stage_label=req.stage_label,
        notes=req.notes,
        lat=req.lat,
        lon=req.lon,
        photo_sha256=req.photo_sha256,
    )
    db.add(entry)
    db.flush()
    append_audit_event(
        db,
        entity_type="monitoring_entry",
        entity_id=entry.id,
        event_type="monitoring.logged",
        payload={
            "plot_id": bld.plot_id,
            "building_id": building_id,
            "entry_type": req.entry_type,
            "stage_label": req.stage_label,
        },
        actor_id=actor["id"],
        actor_role=actor["role"],
    )
    db.commit()
    return {"id": entry.id, "plot_id": entry.plot_id, "building_id": building_id, "stage_label": entry.stage_label}


# ==============================================================================
# PART D (PHASE 3): TRUST LAYER ENDPOINTS (D1 - D6)
# ==============================================================================

_RATE_LIMIT_BUCKETS: Dict[str, List[float]] = {}


def enforce_rate_limit(actor_id: str, max_per_minute: Optional[int] = None) -> None:
    """D6: Simple sliding-window rate limiter per actor."""
    import time

    limit = (
        max_per_minute
        if max_per_minute is not None
        else settings.RATE_LIMIT_MAX_REQUESTS_PER_MINUTE
    )
    now = time.time()
    window_start = now - 60.0
    history = [ts for ts in _RATE_LIMIT_BUCKETS.get(actor_id, []) if ts >= window_start]
    if len(history) >= limit:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded ({limit} requests/minute). Please wait before retrying.",
        )
    history.append(now)
    _RATE_LIMIT_BUCKETS[actor_id] = history


def validate_upload_size_and_mime(raw_bytes: bytes, mime_type: str) -> None:
    """D6: Validate upload size and MIME type before saving to private vault."""
    if mime_type not in settings.ALLOWED_UPLOAD_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported upload MIME type '{mime_type}'. Allowed: {settings.ALLOWED_UPLOAD_MIME_TYPES}",
        )
    if len(raw_bytes) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"Upload size ({len(raw_bytes)} bytes) exceeds maximum allowed ({settings.MAX_UPLOAD_BYTES} bytes).",
        )


def _resolve_target_coordinates_and_polygon(
    db: Session, target_type: str, target_id: str
) -> Tuple[float, float, Optional[List[Tuple[float, float]]]]:
    if target_type == "plot":
        plot = db.execute(select(Plot).where(Plot.id == target_id)).scalar_one_or_none()
        if not plot:
            raise HTTPException(status_code=404, detail="Target plot not found")
        verts = json.loads(plot.vertices_json)
        coords = [(float(v["lon"]), float(v["lat"])) for v in verts]
        return plot.centroid_lat, plot.centroid_lon, coords

    bld = db.execute(select(Building).where(Building.id == target_id)).scalar_one_or_none()
    if not bld:
        raise HTTPException(status_code=404, detail="Target building not found")
    verts = json.loads(bld.footprint_vertices_json)
    coords = [(float(v["lon"]), float(v["lat"])) for v in verts]
    return bld.entrance_lat, bld.entrance_lon, coords


# --- D1: Inspector Workflow ---


@app.post("/api/v1/inspections", status_code=201)
def request_inspection(
    req: InspectionRequestCreate,
    actor: Dict[str, str] = Depends(require_roles("buyer_renter", "owner", "admin")),
    db: Session = Depends(get_db),
):
    """D1: A buyer or renter (especially one abroad/diaspora) requests an inspection of a plot or property."""
    enforce_rate_limit(actor["id"])
    _resolve_target_coordinates_and_polygon(db, req.target_type, req.target_id)

    job = InspectionJob(
        target_type=req.target_type,
        target_id=req.target_id,
        requester_id=actor["id"],
        requester_note=req.requester_note,
        is_diaspora_requester=req.is_diaspora_requester,
        status="requested",
    )
    db.add(job)
    db.flush()

    append_audit_event(
        db,
        entity_type="inspection_job",
        entity_id=job.id,
        event_type="inspection.requested",
        payload={
            "target_type": req.target_type,
            "target_id": req.target_id,
            "requester_id": actor["id"],
            "is_diaspora_requester": req.is_diaspora_requester,
        },
        actor_id=actor["id"],
        actor_role=actor["role"],
    )
    db.commit()
    return {
        "id": job.id,
        "target_type": job.target_type,
        "target_id": job.target_id,
        "status": job.status,
        "requested_at": job.requested_at,
    }


@app.patch("/api/v1/inspections/{job_id}/assign")
def assign_inspector(
    job_id: str,
    req: InspectionAssignRequest,
    actor: Dict[str, str] = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """D1: Admin manually assigns an inspector in v1."""
    job = db.execute(select(InspectionJob).where(InspectionJob.id == job_id)).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Inspection job not found")

    job.assigned_inspector_id = req.inspector_id
    job.assigned_by_admin_id = actor["id"]
    job.status = "assigned"
    job.assigned_at = utcnow_iso()
    db.flush()

    append_audit_event(
        db,
        entity_type="inspection_job",
        entity_id=job.id,
        event_type="inspection.assigned",
        payload={
            "assigned_inspector_id": req.inspector_id,
            "assigned_by_admin_id": actor["id"],
        },
        actor_id=actor["id"],
        actor_role=actor["role"],
    )
    db.commit()
    return {
        "id": job.id,
        "status": job.status,
        "assigned_inspector_id": job.assigned_inspector_id,
        "assigned_at": job.assigned_at,
    }


@app.post("/api/v1/inspections/{job_id}/start")
def start_inspection_on_site(
    job_id: str,
    req: InspectionStartRequest,
    actor: Dict[str, str] = Depends(require_roles("inspector", "admin")),
    db: Session = Depends(get_db),
):
    """
    D1: Inspector must be within 100 m (configurable) of the plot/building to start the inspection.
    """
    job = db.execute(select(InspectionJob).where(InspectionJob.id == job_id)).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Inspection job not found")
    if job.assigned_inspector_id and actor["role"] == "inspector" and job.assigned_inspector_id != actor["id"]:
        raise HTTPException(status_code=403, detail="Only the assigned inspector can start this job.")

    t_lat, t_lon, t_poly = _resolve_target_coordinates_and_polygon(
        db, job.target_type, job.target_id
    )
    geo_check = verify_inspector_start_geofence(
        inspector_lat=req.inspector_lat,
        inspector_lon=req.inspector_lon,
        target_lat=t_lat,
        target_lon=t_lon,
        target_polygon_coords_lon_lat=t_poly,
        max_distance_m=req.max_geofence_m,
    )

    if not geo_check["within_start_geofence"]:
        append_audit_event(
            db,
            entity_type="inspection_job",
            entity_id=job.id,
            event_type="inspection.start_blocked_geofence",
            payload={
                "distance_to_target_m": geo_check["distance_to_target_m"],
                "max_allowed_distance_m": geo_check["max_allowed_distance_m"],
            },
            actor_id=actor["id"],
            actor_role=actor["role"],
        )
        db.commit()
        raise HTTPException(
            status_code=400,
            detail=(
                f"Inspector is {geo_check['distance_to_target_m']} m from the property, "
                f"which exceeds the {geo_check['max_allowed_distance_m']} m on-site start geofence."
            ),
        )

    job.inspector_start_lat = req.inspector_lat
    job.inspector_start_lon = req.inspector_lon
    job.distance_to_target_m = geo_check["distance_to_target_m"]
    job.within_start_geofence = True
    job.status = "in_progress"
    job.started_at = utcnow_iso()
    db.flush()

    append_audit_event(
        db,
        entity_type="inspection_job",
        entity_id=job.id,
        event_type="inspection.started_on_site",
        payload={
            "inspector_lat": req.inspector_lat,
            "inspector_lon": req.inspector_lon,
            "distance_to_target_m": geo_check["distance_to_target_m"],
        },
        actor_id=actor["id"],
        actor_role=actor["role"],
    )
    db.commit()
    return {
        "id": job.id,
        "status": job.status,
        "distance_to_target_m": job.distance_to_target_m,
        "within_start_geofence": job.within_start_geofence,
        "started_at": job.started_at,
    }


@app.post("/api/v1/inspections/{job_id}/submit")
def submit_inspection_report(
    job_id: str,
    req: InspectionSubmitReportRequest,
    actor: Dict[str, str] = Depends(require_roles("inspector", "admin")),
    db: Session = Depends(get_db),
):
    """
    D1: Inspector completes the checklist, captures timestamped photos/video in-app,
    and submits a report. The submitted report becomes an immutable audit event.
    """
    job = db.execute(select(InspectionJob).where(InspectionJob.id == job_id)).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Inspection job not found")
    if job.status == "completed":
        raise HTTPException(status_code=400, detail="Inspection report is already submitted and immutable.")
    if not job.within_start_geofence:
        raise HTTPException(
            status_code=400,
            detail="Inspection must be started within the 100 m on-site geofence before submitting a report.",
        )

    checklist_data = [item.model_dump() for item in req.checklist_items]
    media_data = [m.model_dump() for m in req.media]

    job.checklist_json = json.dumps(checklist_data)
    job.media_json = json.dumps(media_data)
    job.report_summary = req.report_summary
    job.status = "completed"
    job.completed_at = utcnow_iso()
    db.flush()

    audit_ev = append_audit_event(
        db,
        entity_type="inspection_job",
        entity_id=job.id,
        event_type="inspection.report_submitted_immutable",
        payload={
            "target_type": job.target_type,
            "target_id": job.target_id,
            "inspector_id": actor["id"],
            "distance_to_target_m": job.distance_to_target_m,
            "checklist_count": len(checklist_data),
            "media_count": len(media_data),
            "report_summary": req.report_summary,
        },
        actor_id=actor["id"],
        actor_role=actor["role"],
    )
    job.immutable_audit_hash = audit_ev.hash
    db.commit()
    return {
        "id": job.id,
        "status": job.status,
        "immutable_audit_hash": job.immutable_audit_hash,
        "completed_at": job.completed_at,
    }


@app.post("/api/v1/inspections/{job_id}/rate")
def rate_completed_inspection(
    job_id: str,
    req: InspectionRateRequest,
    actor: Dict[str, str] = Depends(require_roles("buyer_renter", "owner", "admin")),
    db: Session = Depends(get_db),
):
    """D1: Rating (1-5) after inspection completion."""
    job = db.execute(select(InspectionJob).where(InspectionJob.id == job_id)).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Inspection job not found")
    if job.status != "completed":
        raise HTTPException(status_code=400, detail="Can only rate a completed inspection.")

    job.buyer_rating = req.rating
    job.buyer_review_comment = req.review_comment
    db.flush()

    append_audit_event(
        db,
        entity_type="inspection_job",
        entity_id=job.id,
        event_type="inspection.rated",
        payload={"rating": req.rating, "review_comment": req.review_comment},
        actor_id=actor["id"],
        actor_role=actor["role"],
    )
    db.commit()
    return {
        "id": job.id,
        "buyer_rating": job.buyer_rating,
        "buyer_review_comment": job.buyer_review_comment,
    }


@app.get("/api/v1/inspections")
def list_inspections(
    db: Session = Depends(get_db),
):
    jobs = db.execute(select(InspectionJob).order_by(InspectionJob.requested_at.desc())).scalars().all()
    return [
        {
            "id": j.id,
            "target_type": j.target_type,
            "target_id": j.target_id,
            "requester_id": j.requester_id,
            "assigned_inspector_id": j.assigned_inspector_id,
            "status": j.status,
            "distance_to_target_m": j.distance_to_target_m,
            "within_start_geofence": j.within_start_geofence,
            "report_summary": j.report_summary,
            "immutable_audit_hash": j.immutable_audit_hash,
            "buyer_rating": j.buyer_rating,
            "buyer_review_comment": j.buyer_review_comment,
            "requested_at": j.requested_at,
            "completed_at": j.completed_at,
        }
        for j in jobs
    ]


# --- D2: Agent Verification ---


@app.post("/api/v1/agents/profile", status_code=201)
def submit_agent_verification_profile(
    req: AgentProfileSubmitRequest,
    actor: Dict[str, str] = Depends(require_roles("agent")),
    db: Session = Depends(get_db),
):
    """
    D2: Agent submits registration body (e.g. LASRERA, NIESV), registration number, and ID document.
    Status starts at 'uploaded'. Agents cannot promote their own status.
    """
    try:
        raw_bytes = base64.b64decode(req.id_document_base64)
    except Exception:
        raw_bytes = req.id_document_base64.encode("utf-8")

    validate_upload_size_and_mime(raw_bytes, req.id_document_mime_type)
    sha256_hex = compute_sha256_bytes(raw_bytes)
    storage_key = save_to_private_vault(raw_bytes, prefix="agent_id", ext=".pdf")

    existing = (
        db.execute(
            select(AgentVerificationRecord).where(
                AgentVerificationRecord.agent_id == actor["id"]
            )
        )
        .scalars()
        .first()
    )
    if existing:
        existing.registration_body = req.registration_body.strip()
        existing.registration_number = req.registration_number.strip()
        existing.id_document_key = storage_key
        existing.id_document_filename = req.id_document_filename
        existing.id_document_sha256 = sha256_hex
        existing.status = "uploaded"
        existing.outcome = "pending"
        existing.badge_text = "Agent registration uploaded — pending admin check"
        existing.updated_at = utcnow_iso()
        rec = existing
    else:
        rec = AgentVerificationRecord(
            agent_id=actor["id"],
            registration_body=req.registration_body.strip(),
            registration_number=req.registration_number.strip(),
            id_document_key=storage_key,
            id_document_filename=req.id_document_filename,
            id_document_sha256=sha256_hex,
            status="uploaded",
            outcome="pending",
            badge_text="Agent registration uploaded — pending admin check",
        )
        db.add(rec)

    db.flush()
    append_audit_event(
        db,
        entity_type="agent_verification",
        entity_id=rec.id,
        event_type="agent.profile_submitted",
        payload={
            "agent_id": actor["id"],
            "registration_body": rec.registration_body,
            "registration_number": rec.registration_number,
            "id_document_sha256": sha256_hex,
            "status": rec.status,
        },
        actor_id=actor["id"],
        actor_role=actor["role"],
    )
    db.commit()
    return {
        "id": rec.id,
        "agent_id": rec.agent_id,
        "registration_body": rec.registration_body,
        "registration_number": rec.registration_number,
        "status": rec.status,
        "outcome": rec.outcome,
        "badge_text": rec.badge_text,
    }


@app.patch("/api/v1/admin/agents/{agent_id}/check")
def admin_check_agent_registration(
    agent_id: str,
    req: AgentAdminCheckRequest,
    actor: Dict[str, str] = Depends(get_actor),
    db: Session = Depends(get_db),
):
    """
    D2: Admin manually checks the official register and records the date and outcome.
    Badge text states exactly what was checked: "Registration number checked by admin on <date>".
    Agents cannot change their own status (403).
    """
    if actor["role"] != "admin":
        raise HTTPException(
            status_code=403,
            detail="Agents and non-admin users cannot change agent verification status.",
        )

    rec = (
        db.execute(
            select(AgentVerificationRecord).where(
                AgentVerificationRecord.agent_id == agent_id
            )
        )
        .scalars()
        .first()
    )
    if not rec:
        raise HTTPException(status_code=404, detail="Agent verification profile not found")

    rec.checked_by_admin_id = actor["id"]
    rec.checked_on_date = req.checked_on_date.strip()
    rec.outcome = req.outcome
    rec.admin_notes = req.admin_notes

    if req.outcome == "checked_ok":
        rec.status = "reviewed_by_admin"
        rec.badge_text = f"Registration number checked by admin on {rec.checked_on_date}"
    else:
        rec.status = "under_review"
        rec.badge_text = f"Registration check noted discrepancy on {rec.checked_on_date} — under review"

    rec.updated_at = utcnow_iso()

    user_row = db.execute(select(User).where(User.id == agent_id)).scalar_one_or_none()
    if user_row:
        user_row.agent_regulator = rec.registration_body
        user_row.agent_reg_number = rec.registration_number
        user_row.agent_checked_at = rec.checked_on_date
        user_row.agent_checked_by_admin = req.outcome == "checked_ok"

    db.flush()
    append_audit_event(
        db,
        entity_type="agent_verification",
        entity_id=rec.id,
        event_type="agent.register_checked_by_admin",
        payload={
            "agent_id": agent_id,
            "registration_body": rec.registration_body,
            "registration_number": rec.registration_number,
            "outcome": rec.outcome,
            "checked_on_date": rec.checked_on_date,
            "badge_text": rec.badge_text,
        },
        actor_id=actor["id"],
        actor_role=actor["role"],
    )
    db.commit()
    return {
        "id": rec.id,
        "agent_id": rec.agent_id,
        "registration_body": rec.registration_body,
        "registration_number": rec.registration_number,
        "status": rec.status,
        "outcome": rec.outcome,
        "checked_on_date": rec.checked_on_date,
        "badge_text": rec.badge_text,
    }


# --- D3: Price Benchmarking ---


@app.get("/api/v1/benchmarks/plots/{plot_id}")
def get_plot_price_benchmark(
    plot_id: str,
    radius_km: float = Query(default=3.0, gt=0),
    db: Session = Depends(get_db),
):
    """
    D3: Price per m² compared with comparable plots (same type, state/LGA, configurable radius e.g. 3 km).
    With 8 or more comps, shows P5-P95 percentile band and flags extreme outliers.
    With fewer than 8 comps, returns 'insufficient_data'.
    """
    target = db.execute(select(Plot).where(Plot.id == plot_id)).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Plot not found")

    all_plots = db.execute(select(Plot)).scalars().all()
    rate = settings.DEFAULT_NGN_PER_USD

    def to_ngn(amount: float, currency: str) -> float:
        return amount * rate if currency == "USD" else amount

    candidates = [
        {
            "id": p.id,
            "title": p.title,
            "type": "plot",
            "state": p.state,
            "lga": p.lga,
            "lat": p.centroid_lat,
            "lon": p.centroid_lon,
            "area_m2": p.computed_area_m2,
            "price_ngn": to_ngn(p.asking_price, p.currency),
        }
        for p in all_plots
    ]

    return compute_price_benchmark(
        target_id=target.id,
        target_type="plot",
        target_price_ngn=to_ngn(target.asking_price, target.currency),
        target_area_m2=target.computed_area_m2,
        target_lat=target.centroid_lat,
        target_lon=target.centroid_lon,
        target_state=target.state,
        target_lga=target.lga,
        candidates=candidates,
        radius_km=radius_km,
    )


# --- D4: Proof-of-Payment Trail ---


@app.post("/api/v1/payment-receipts", status_code=201)
def upload_payment_receipt(
    req: PaymentReceiptCreateRequest,
    actor: Dict[str, str] = Depends(require_roles("buyer_renter", "owner", "agent", "admin")),
    db: Session = Depends(get_db),
):
    """
    D4: Buyer/renter and seller upload receipts (amount, date, method, reference, payer, payee)
    for deposits, rent, or purchase stages. Receipts are audit events. No money moves through the platform.
    """
    enforce_rate_limit(actor["id"])
    storage_key = None
    sha256_hex = None
    if req.receipt_base64:
        try:
            raw_bytes = base64.b64decode(req.receipt_base64)
        except Exception:
            raw_bytes = req.receipt_base64.encode("utf-8")
        validate_upload_size_and_mime(raw_bytes, req.receipt_mime_type)
        sha256_hex = compute_sha256_bytes(raw_bytes)
        storage_key = save_to_private_vault(raw_bytes, prefix="receipt", ext=".pdf")

    is_buyer = actor["role"] == "buyer_renter"
    receipt = ProofOfPaymentReceipt(
        target_type=req.target_type,
        target_id=req.target_id,
        uploaded_by_id=actor["id"],
        uploaded_by_role=actor["role"],
        stage=req.stage,
        amount=req.amount,
        currency=req.currency,
        payment_date=req.payment_date,
        payment_method=req.payment_method,
        bank_reference=req.bank_reference,
        payer_name=req.payer_name,
        payee_name=req.payee_name,
        receipt_storage_key=storage_key,
        receipt_sha256=sha256_hex,
        buyer_status="confirmed" if is_buyer else "pending",
        seller_status="confirmed" if not is_buyer else "pending",
    )
    db.add(receipt)
    db.flush()

    ev = append_audit_event(
        db,
        entity_type="payment_receipt",
        entity_id=receipt.id,
        event_type="payment_receipt.uploaded",
        payload={
            "target_type": req.target_type,
            "target_id": req.target_id,
            "stage": req.stage,
            "amount": req.amount,
            "currency": req.currency,
            "bank_reference": req.bank_reference,
            "payer_name": req.payer_name,
            "payee_name": req.payee_name,
        },
        actor_id=actor["id"],
        actor_role=actor["role"],
    )
    receipt.audit_event_hash = ev.hash
    db.commit()
    return {
        "id": receipt.id,
        "stage": receipt.stage,
        "amount": receipt.amount,
        "currency": receipt.currency,
        "buyer_status": receipt.buyer_status,
        "seller_status": receipt.seller_status,
        "audit_event_hash": receipt.audit_event_hash,
    }


@app.patch("/api/v1/payment-receipts/{receipt_id}/respond")
def respond_to_payment_receipt(
    receipt_id: str,
    req: PaymentReceiptConfirmDisputeRequest,
    actor: Dict[str, str] = Depends(require_roles("buyer_renter", "owner", "agent", "admin")),
    db: Session = Depends(get_db),
):
    """D4: Both buyer/renter and seller can confirm or dispute a payment receipt."""
    receipt = (
        db.execute(select(ProofOfPaymentReceipt).where(ProofOfPaymentReceipt.id == receipt_id))
        .scalar_one_or_none()
    )
    if not receipt:
        raise HTTPException(status_code=404, detail="Payment receipt not found")

    if req.party_role == "buyer":
        receipt.buyer_status = req.decision
    else:
        receipt.seller_status = req.decision

    if req.notes:
        receipt.dispute_notes = req.notes
    receipt.updated_at = utcnow_iso()
    db.flush()

    ev = append_audit_event(
        db,
        entity_type="payment_receipt",
        entity_id=receipt.id,
        event_type=f"payment_receipt.{req.party_role}_{req.decision}",
        payload={
            "party_role": req.party_role,
            "decision": req.decision,
            "buyer_status": receipt.buyer_status,
            "seller_status": receipt.seller_status,
            "notes": req.notes,
        },
        actor_id=actor["id"],
        actor_role=actor["role"],
    )
    receipt.audit_event_hash = ev.hash
    db.commit()
    return {
        "id": receipt.id,
        "buyer_status": receipt.buyer_status,
        "seller_status": receipt.seller_status,
        "dispute_notes": receipt.dispute_notes,
        "audit_event_hash": receipt.audit_event_hash,
    }


# --- D5 & D6: Suspicious Listing Reports & Unified Admin Trust Overview ---


@app.post("/api/v1/reports/suspicious", status_code=201)
def report_suspicious_listing(
    req: SuspiciousReportCreateRequest,
    actor: Dict[str, str] = Depends(require_roles("buyer_renter", "owner", "agent", "inspector", "admin")),
    db: Session = Depends(get_db),
):
    """D6: User reports a suspicious listing; routed to Admin queue and recorded in audit chain."""
    enforce_rate_limit(actor["id"])
    rep = SuspiciousListingReport(
        target_type=req.target_type,
        target_id=req.target_id,
        reporter_id=actor["id"],
        reporter_role=actor["role"],
        reason_category=req.reason_category,
        description=req.description.strip(),
        status="open",
    )
    db.add(rep)
    db.flush()

    append_audit_event(
        db,
        entity_type="suspicious_report",
        entity_id=rep.id,
        event_type="listing.suspicious_report_submitted",
        payload={
            "target_type": req.target_type,
            "target_id": req.target_id,
            "reason_category": req.reason_category,
        },
        actor_id=actor["id"],
        actor_role=actor["role"],
    )
    db.commit()
    return {
        "id": rep.id,
        "target_type": rep.target_type,
        "target_id": rep.target_id,
        "reason_category": rep.reason_category,
        "status": rep.status,
    }


@app.get("/api/v1/admin/trust-overview")
def get_admin_trust_overview(
    actor: Dict[str, str] = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """D5: Unified Admin Dashboard queues (documents, flags, agents, inspections, suspicious reports) & chain verification."""
    docs = db.execute(select(DocumentChecklistItem)).scalars().all()
    flags = db.execute(select(SpatialFlag)).scalars().all()
    agents = db.execute(select(AgentVerificationRecord)).scalars().all()
    inspections = db.execute(select(InspectionJob)).scalars().all()
    reports = db.execute(select(SuspiciousListingReport)).scalars().all()
    receipts = db.execute(select(ProofOfPaymentReceipt)).scalars().all()
    chain_status = verify_audit_chain(db)

    return {
        "queues": {
            "pending_documents": sum(1 for d in docs if d.status in ("uploaded", "under_review")),
            "open_spatial_flags": sum(1 for f in flags if f.status == "open"),
            "pending_agent_checks": sum(1 for a in agents if a.outcome == "pending"),
            "active_inspections": sum(1 for i in inspections if i.status != "completed"),
            "open_suspicious_reports": sum(1 for r in reports if r.status == "open"),
            "disputed_payment_receipts": sum(
                1 for p in receipts if p.buyer_status == "disputed" or p.seller_status == "disputed"
            ),
        },
        "audit_chain": chain_status,
    }



