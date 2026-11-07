import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from app.database import Base


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def gen_uuid() -> str:
    return str(uuid.uuid4())


# Allowed Document & Evidence Item Statuses (Part A Non-Negotiable Rule #1)
ALLOWED_EVIDENCE_STATUSES = (
    "not_provided",
    "uploaded",
    "under_review",
    "reviewed_by_admin",
    "externally_verified",
)

# Allowed User Roles (Part A #5)
ALLOWED_ROLES = (
    "visitor",
    "buyer_renter",
    "owner",
    "agent",
    "inspector",
    "admin",
)


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone = Column(String(50), nullable=True)
    role = Column(String(32), nullable=False, default="buyer_renter")
    agent_regulator = Column(String(64), nullable=True)  # e.g., LASRERA, NIESV
    agent_reg_number = Column(String(64), nullable=True)
    agent_checked_at = Column(String(32), nullable=True)
    agent_checked_by_admin = Column(Boolean, default=False)
    ndpa_consent_at = Column(String(32), nullable=False, default=utcnow_iso)
    created_at = Column(String(32), nullable=False, default=utcnow_iso)


class ConsentRecord(Base):
    __tablename__ = "consent_records"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    purpose = Column(String(255), nullable=False)
    policy_version = Column(String(32), nullable=False, default="NDPA-2023-v1")
    granted_at = Column(String(32), nullable=False, default=utcnow_iso)


class Plot(Base):
    __tablename__ = "plots"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    owner_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    state = Column(String(100), nullable=False, index=True)
    lga = Column(String(100), nullable=False, index=True)
    area_name = Column(String(150), nullable=False)
    purpose = Column(String(32), nullable=False)  # sale | lease | construction
    asking_price = Column(Float, nullable=False)
    currency = Column(String(8), nullable=False, default="NGN")  # NGN | USD
    declared_area_m2 = Column(Float, nullable=True)
    sqm_per_plot = Column(Float, nullable=False)  # Configurable per listing, never hardcoded

    measurement_method = Column(String(32), nullable=False)  # gps_walk | satellite_trace | surveyor_plan
    polygon_geojson = Column(Text, nullable=False)  # Canonical GeoJSON Polygon
    vertices_json = Column(Text, nullable=False)  # JSON list of {lat, lon, accuracy_m, samples}

    centroid_lat = Column(Float, nullable=False, index=True)
    centroid_lon = Column(Float, nullable=False, index=True)
    public_fuzzed_lat = Column(Float, nullable=False)
    public_fuzzed_lon = Column(Float, nullable=False)
    is_occupied_home = Column(Boolean, nullable=False, default=False)

    mean_accuracy_m = Column(Float, nullable=False)
    computed_area_m2 = Column(Float, nullable=False)
    area_low_m2 = Column(Float, nullable=False)
    area_high_m2 = Column(Float, nullable=False)
    computed_perimeter_m = Column(Float, nullable=False)

    status = Column(String(32), nullable=False, default="published")  # draft | published | under_review | archived
    created_at = Column(String(32), nullable=False, default=utcnow_iso)
    updated_at = Column(String(32), nullable=False, default=utcnow_iso)


class EvidencePhoto(Base):
    __tablename__ = "evidence_photos"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    plot_id = Column(String(36), ForeignKey("plots.id"), nullable=False, index=True)
    uploader_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    capture_source = Column(String(32), nullable=False)  # in_app | uploaded
    private_storage_key = Column(String(255), nullable=False)
    filename = Column(String(255), nullable=False)
    mime_type = Column(String(64), nullable=False, default="image/jpeg")

    sha256_hash = Column(String(64), nullable=False, index=True)
    phash_64 = Column(String(32), nullable=False, index=True)

    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    gps_accuracy_m = Column(Float, nullable=False)
    distance_to_plot_m = Column(Float, nullable=False)
    within_geofence = Column(Boolean, nullable=False, default=True)
    is_reused_across_listings = Column(Boolean, nullable=False, default=False)
    reused_from_plot_id = Column(String(36), nullable=True)

    client_captured_at = Column(String(32), nullable=False)
    server_received_at = Column(String(32), nullable=False, default=utcnow_iso)


class DocumentChecklistItem(Base):
    __tablename__ = "document_checklist_items"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    plot_id = Column(String(36), ForeignKey("plots.id"), nullable=False, index=True)
    uploader_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    category = Column(String(64), nullable=False)
    # survey_plan | title_document | governors_consent | deed_of_assignment | external_report | other
    title = Column(String(255), nullable=False)
    private_storage_key = Column(String(255), nullable=True)
    filename = Column(String(255), nullable=True)
    mime_type = Column(String(64), nullable=True)
    sha256_hash = Column(String(64), nullable=True)

    # Strictly one of: not_provided | uploaded | under_review | reviewed_by_admin | externally_verified
    status = Column(String(32), nullable=False, default="not_provided")

    # B4: Surveyor plan fields
    plan_number = Column(String(100), nullable=True)
    surveyor_name = Column(String(150), nullable=True)
    surveyor_reg_no = Column(String(100), nullable=True)
    stated_area_m2 = Column(Float, nullable=True)
    area_diff_pct = Column(Float, nullable=True)

    # Required when status == externally_verified
    external_report_id = Column(String(36), nullable=True)
    reviewed_by_admin_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    admin_notes = Column(Text, nullable=True)

    created_at = Column(String(32), nullable=False, default=utcnow_iso)
    updated_at = Column(String(32), nullable=False, default=utcnow_iso)


class SpatialFlag(Base):
    __tablename__ = "spatial_flags"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    plot_id = Column(String(36), ForeignKey("plots.id"), nullable=False, index=True)
    conflicting_plot_id = Column(String(36), ForeignKey("plots.id"), nullable=True, index=True)
    flag_type = Column(String(64), nullable=False)
    # possible_overlap | possible_duplicate | area_discrepancy | reused_image | photo_geofence_warning | insufficient_photos
    severity = Column(String(32), nullable=False, default="warning")
    metric_value = Column(Float, nullable=False, default=0.0)
    public_summary = Column(String(255), nullable=False)
    admin_detail = Column(Text, nullable=False)
    status = Column(String(32), nullable=False, default="open")  # open | reviewed_by_admin | dismissed
    admin_notes = Column(Text, nullable=True)
    reviewed_by_admin_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_at = Column(String(32), nullable=False, default=utcnow_iso)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    seq = Column(Integer, primary_key=True, autoincrement=True)
    entity_type = Column(String(64), nullable=False, index=True)
    entity_id = Column(String(36), nullable=False, index=True)
    actor_id = Column(String(36), nullable=True, index=True)
    actor_role = Column(String(32), nullable=True)
    event_type = Column(String(64), nullable=False, index=True)
    payload_json = Column(Text, nullable=False)  # Canonical JSON string
    created_at = Column(String(32), nullable=False)
    prev_hash = Column(String(64), nullable=False)
    hash = Column(String(64), unique=True, nullable=False, index=True)


# ==============================================================================
# PART C (PHASE 2): BUILT HOUSES & APARTMENTS MODELS (C1 - C7)
# ==============================================================================

ALLOWED_PROPERTY_TYPES = ("house", "duplex", "block_of_flats", "single_unit")

MANDATORY_CONDITION_ITEMS = (
    "roof",
    "ceiling",
    "walls_cracks",
    "floors",
    "doors_windows",
    "electrical",
    "plumbing",
    "water_supply",
    "drainage_flooding",
    "fence_gate",
    "access_road",
)

ALLOWED_CONDITION_RATINGS = ("good", "fair", "poor", "not_checked")


class Building(Base):
    """C1: Building record with optional parent plot link, footprint polygon, entrance GPS, and storeys."""

    __tablename__ = "buildings"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    owner_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    plot_id = Column(String(36), ForeignKey("plots.id"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    property_type = Column(String(32), nullable=False)  # house | duplex | block_of_flats | single_unit
    address = Column(String(255), nullable=False)
    state = Column(String(100), nullable=False, index=True)
    lga = Column(String(100), nullable=False, index=True)
    storeys = Column(Integer, nullable=False, default=1)
    year_built = Column(Integer, nullable=True)

    measurement_method = Column(String(32), nullable=False, default="gps_walk")
    footprint_geojson = Column(Text, nullable=False)
    footprint_vertices_json = Column(Text, nullable=False)
    footprint_area_m2 = Column(Float, nullable=False)
    footprint_area_low_m2 = Column(Float, nullable=False)
    footprint_area_high_m2 = Column(Float, nullable=False)
    footprint_perimeter_m = Column(Float, nullable=False)
    mean_accuracy_m = Column(Float, nullable=False, default=3.0)

    entrance_lat = Column(Float, nullable=False)
    entrance_lon = Column(Float, nullable=False)
    public_fuzzed_lat = Column(Float, nullable=False)
    public_fuzzed_lon = Column(Float, nullable=False)
    is_occupied_home = Column(Boolean, nullable=False, default=True)

    # C1 acceptance check: footprint must fall inside linked plot polygon, otherwise flag
    footprint_inside_plot = Column(Boolean, nullable=False, default=True)
    footprint_outside_ratio = Column(Float, nullable=False, default=0.0)

    # C7: Configurable re-inspection reminders
    reinspection_interval_days = Column(Integer, nullable=False, default=90)
    next_reinspection_due_at = Column(String(32), nullable=True)

    created_at = Column(String(32), nullable=False, default=utcnow_iso)
    updated_at = Column(String(32), nullable=False, default=utcnow_iso)


class PropertyUnit(Base):
    """C1 & C2: Individual unit inside a building (building -> units hierarchy)."""

    __tablename__ = "property_units"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    building_id = Column(String(36), ForeignKey("buildings.id"), nullable=False, index=True)
    unit_name = Column(String(120), nullable=False)  # e.g., "Flat 2B", "Main Duplex Wing"
    floor_number = Column(Integer, nullable=False, default=0)
    bedrooms = Column(Integer, nullable=False, default=1)
    bathrooms = Column(Integer, nullable=False, default=1)

    # Nigerian utility & infrastructure specifics (C1)
    power_meter_type = Column(String(64), nullable=False, default="prepaid")  # prepaid | postpaid | solar_inverter
    power_disco = Column(String(64), nullable=False, default="IKEDC")  # IKEDC, EKEDC, IBEDC, AEDC, PHED...
    water_source = Column(String(100), nullable=False, default="borehole_treatment")
    drainage_flood_notes = Column(Text, nullable=False, default="")
    security_features = Column(Text, nullable=False, default="")

    # C2: Declared unit area vs computed sum of room areas (>20% discrepancy flag)
    declared_area_m2 = Column(Float, nullable=True)
    computed_room_area_sum_m2 = Column(Float, nullable=False, default=0.0)
    room_area_diff_pct = Column(Float, nullable=False, default=0.0)
    room_area_discrepancy_flagged = Column(Boolean, nullable=False, default=False)

    # C5: Rental occupancy status & lease dates to prevent double-letting
    occupancy_status = Column(String(32), nullable=False, default="vacant")
    # vacant | tenant_occupied | owner_occupied | under_renovation
    lease_start_date = Column(String(32), nullable=True)
    lease_end_date = Column(String(32), nullable=True)

    created_at = Column(String(32), nullable=False, default=utcnow_iso)


class RoomDimension(Base):
    """C2: Manual L x W x H or feature-detected experimental WebXR room measurements."""

    __tablename__ = "room_dimensions"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    unit_id = Column(String(36), ForeignKey("property_units.id"), nullable=False, index=True)
    room_name = Column(String(100), nullable=False)  # Living Room, Master Bedroom, Kitchen...
    length_m = Column(Float, nullable=False)
    width_m = Column(Float, nullable=False)
    height_m = Column(Float, nullable=False, default=3.0)
    computed_area_m2 = Column(Float, nullable=False)
    measurement_source = Column(String(32), nullable=False, default="manual")
    # manual | webxr_experimental
    created_at = Column(String(32), nullable=False, default=utcnow_iso)


class ConditionChecklist(Base):
    """C3: 11-item structural & utility condition checklist labelled 'self_declared' or 'inspected_by_inspector'."""

    __tablename__ = "condition_checklists"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    building_id = Column(String(36), ForeignKey("buildings.id"), nullable=False, index=True)
    unit_id = Column(String(36), ForeignKey("property_units.id"), nullable=True, index=True)
    author_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    author_role = Column(String(32), nullable=False)
    declaration_label = Column(String(120), nullable=False)
    # "self-declared" or "inspected by <inspector>"
    items_json = Column(Text, nullable=False)
    # JSON array of {category, rating, notes, photo_ids}
    created_at = Column(String(32), nullable=False, default=utcnow_iso)


class BuildingPhoto(Base):
    """C4: Exterior and per-room photos reused from B6 with 50m geofence around building entrance."""

    __tablename__ = "building_photos"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    building_id = Column(String(36), ForeignKey("buildings.id"), nullable=False, index=True)
    unit_id = Column(String(36), ForeignKey("property_units.id"), nullable=True, index=True)
    room_name = Column(String(100), nullable=True)  # null for exterior
    uploader_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    capture_source = Column(String(32), nullable=False)  # in_app | uploaded
    sha256_hash = Column(String(64), nullable=False, index=True)
    phash_64 = Column(String(32), nullable=False, index=True)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    gps_accuracy_m = Column(Float, nullable=False)
    distance_to_building_m = Column(Float, nullable=False)
    within_geofence = Column(Boolean, nullable=False, default=True)
    is_reused_across_listings = Column(Boolean, nullable=False, default=False)
    client_captured_at = Column(String(32), nullable=False)
    server_received_at = Column(String(32), nullable=False, default=utcnow_iso)


class AgentAuthorization(Base):
    """C5: Explicit owner-to-agent authorization for a specific property unit."""

    __tablename__ = "agent_authorizations"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    unit_id = Column(String(36), ForeignKey("property_units.id"), nullable=False, index=True)
    owner_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    agent_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String(32), nullable=False, default="active")  # active | revoked
    created_at = Column(String(32), nullable=False, default=utcnow_iso)


class UnitListing(Base):
    """
    C5: One-active-listing rule per unit enforced at BOTH the application level
    and the database level via partial unique index `ix_one_active_primary_listing_per_unit`.
    """

    __tablename__ = "unit_listings"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    unit_id = Column(String(36), ForeignKey("property_units.id"), nullable=False, index=True)
    building_id = Column(String(36), ForeignKey("buildings.id"), nullable=False, index=True)
    lister_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    lister_role = Column(String(32), nullable=False)
    listing_type = Column(String(32), nullable=False, default="rent")  # sale | rent | short_let
    asking_price = Column(Float, nullable=False)
    currency = Column(String(8), nullable=False, default="NGN")
    status = Column(String(32), nullable=False, default="active")  # active | closed | blocked_conflict
    is_primary_active = Column(Boolean, nullable=False, default=True)
    linked_owner_listing_id = Column(String(36), ForeignKey("unit_listings.id"), nullable=True)
    authorization_id = Column(String(36), ForeignKey("agent_authorizations.id"), nullable=True)
    created_at = Column(String(32), nullable=False, default=utcnow_iso)

    __table_args__ = (
        Index(
            "ix_one_active_primary_listing_per_unit",
            "unit_id",
            unique=True,
            sqlite_where=text("status = 'active' AND is_primary_active = 1"),
            postgresql_where=text("status = 'active' AND is_primary_active = true"),
        ),
    )


class ConflictingListingClaim(Base):
    """C5: Blocked second active listing attempts routed to Admin as a conflicting claim."""

    __tablename__ = "conflicting_listing_claims"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    unit_id = Column(String(36), ForeignKey("property_units.id"), nullable=False, index=True)
    existing_listing_id = Column(String(36), ForeignKey("unit_listings.id"), nullable=False)
    claimant_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    claimant_role = Column(String(32), nullable=False)
    attempted_price = Column(Float, nullable=False)
    currency = Column(String(8), nullable=False, default="NGN")
    reason = Column(String(255), nullable=False)
    status = Column(String(32), nullable=False, default="open")  # open | resolved_by_admin
    admin_notes = Column(Text, nullable=True)
    created_at = Column(String(32), nullable=False, default=utcnow_iso)


class OwnershipClaimEvent(Base):
    """C6: Ownership/status timeline recorded as claims with documents, reviewed by admin, logged in audit chain."""

    __tablename__ = "ownership_claim_events"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    building_id = Column(String(36), ForeignKey("buildings.id"), nullable=False, index=True)
    claimant_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    claim_type = Column(String(64), nullable=False)
    # initial_claim | transfer_of_interest | lease_status_update | encumbrance_note
    summary = Column(String(255), nullable=False)
    document_ref = Column(String(255), nullable=False)
    status = Column(String(32), nullable=False, default="under_review")
    # Allowed statuses: uploaded | under_review | reviewed_by_admin | externally_verified
    admin_notes = Column(Text, nullable=True)
    created_at = Column(String(32), nullable=False, default=utcnow_iso)


class MonitoringEntry(Base):
    """C7: Maintenance log and dated, geotagged construction photo timeline linking plot -> building."""

    __tablename__ = "monitoring_entries"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    plot_id = Column(String(36), ForeignKey("plots.id"), nullable=True, index=True)
    building_id = Column(String(36), ForeignKey("buildings.id"), nullable=False, index=True)
    author_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    entry_type = Column(String(64), nullable=False)
    # construction_milestone | maintenance_log | reinspection_check
    stage_label = Column(String(120), nullable=False)  # e.g., "Foundation & DPC", "Roofing", "Plumbing Maintenance"
    notes = Column(Text, nullable=False)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    photo_sha256 = Column(String(64), nullable=True)
    captured_at = Column(String(32), nullable=False, default=utcnow_iso)


# ==============================================================================
# PART D (PHASE 3): TRUST LAYER MODELS (D1 - D6)
# ==============================================================================


class InspectionJob(Base):
    """
    D1: Inspector workflow.
    A buyer/renter (especially abroad/diaspora) requests an inspection of a plot or property.
    Admin assigns an inspector (manual in v1).
    Inspector must be within 100 m (configurable) to start, completes checklist, captures
    timestamped photos/video in-app, and submits a report which becomes an immutable audit event.
    """

    __tablename__ = "inspection_jobs"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    target_type = Column(String(32), nullable=False, index=True)  # plot | building
    target_id = Column(String(36), nullable=False, index=True)
    requester_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    requester_note = Column(Text, nullable=False, default="")
    is_diaspora_requester = Column(Boolean, nullable=False, default=False)

    assigned_inspector_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    assigned_by_admin_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    status = Column(String(32), nullable=False, default="requested")
    # requested | assigned | in_progress | completed

    # 100 m geofence check on start
    inspector_start_lat = Column(Float, nullable=True)
    inspector_start_lon = Column(Float, nullable=True)
    distance_to_target_m = Column(Float, nullable=True)
    within_start_geofence = Column(Boolean, nullable=True)

    # Submitted report fields (immutable once completed)
    checklist_json = Column(Text, nullable=True)
    media_json = Column(Text, nullable=True)  # In-app timestamped photos/videos
    report_summary = Column(Text, nullable=True)
    immutable_audit_hash = Column(String(64), nullable=True)

    # Post-completion rating by buyer/renter (1-5)
    buyer_rating = Column(Integer, nullable=True)
    buyer_review_comment = Column(Text, nullable=True)

    requested_at = Column(String(32), nullable=False, default=utcnow_iso)
    assigned_at = Column(String(32), nullable=True)
    started_at = Column(String(32), nullable=True)
    completed_at = Column(String(32), nullable=True)


class AgentVerificationRecord(Base):
    """
    D2: Agent verification profile with registration body (e.g., LASRERA, NIESV, ESVARBON),
    registration number, and privately stored ID document.
    Admin manually checks the official register and records the date and outcome.
    Badge text states exactly what was checked: "Registration number checked by admin on <date>".
    Agents cannot change their own status.
    """

    __tablename__ = "agent_verification_records"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    agent_id = Column(String(36), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    registration_body = Column(String(64), nullable=False)  # LASRERA | NIESV | ESVARBON | REDAN | Other
    registration_number = Column(String(100), nullable=False)
    id_document_key = Column(String(255), nullable=False)
    id_document_filename = Column(String(255), nullable=False, default="agent_id.pdf")
    id_document_sha256 = Column(String(64), nullable=False)

    # Allowed statuses: uploaded | under_review | reviewed_by_admin | externally_verified
    status = Column(String(32), nullable=False, default="uploaded")
    outcome = Column(String(32), nullable=False, default="pending")  # pending | checked_ok | mismatch_noted
    checked_by_admin_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    checked_on_date = Column(String(32), nullable=True)
    admin_notes = Column(Text, nullable=True)
    badge_text = Column(String(255), nullable=False, default="Agent registration uploaded — pending admin check")

    created_at = Column(String(32), nullable=False, default=utcnow_iso)
    updated_at = Column(String(32), nullable=False, default=utcnow_iso)


class ProofOfPaymentReceipt(Base):
    """
    D4: Proof-of-payment trail.
    Buyer/renter and seller upload receipts (amount, date, method, reference, payer, payee)
    for deposits, rent, or purchase stages. Receipts are audit events.
    Both parties can confirm or dispute. No money moves through the platform.
    """

    __tablename__ = "proof_of_payment_receipts"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    target_type = Column(String(32), nullable=False, index=True)  # plot | building | unit
    target_id = Column(String(36), nullable=False, index=True)
    uploaded_by_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    uploaded_by_role = Column(String(32), nullable=False)

    stage = Column(String(64), nullable=False)  # deposit | rent | purchase_instalment | final_balance
    amount = Column(Float, nullable=False)
    currency = Column(String(8), nullable=False, default="NGN")  # NGN | USD
    payment_date = Column(String(32), nullable=False)
    payment_method = Column(String(64), nullable=False)  # bank_transfer | manager_cheque | escrow_transfer
    bank_reference = Column(String(120), nullable=False)
    payer_name = Column(String(150), nullable=False)
    payee_name = Column(String(150), nullable=False)

    receipt_storage_key = Column(String(255), nullable=True)
    receipt_sha256 = Column(String(64), nullable=True)

    # Dual-party confirmation state
    buyer_status = Column(String(32), nullable=False, default="pending")  # pending | confirmed | disputed
    seller_status = Column(String(32), nullable=False, default="pending")  # pending | confirmed | disputed
    dispute_notes = Column(Text, nullable=True)
    audit_event_hash = Column(String(64), nullable=True)

    created_at = Column(String(32), nullable=False, default=utcnow_iso)
    updated_at = Column(String(32), nullable=False, default=utcnow_iso)


class SuspiciousListingReport(Base):
    """
    D6: User reports of suspicious listings routed to the Admin review queue.
    """

    __tablename__ = "suspicious_listing_reports"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    target_type = Column(String(32), nullable=False, index=True)  # plot | building | unit
    target_id = Column(String(36), nullable=False, index=True)
    reporter_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    reporter_role = Column(String(32), nullable=False)
    reason_category = Column(String(64), nullable=False)
    # possible_duplicate_claim | unverified_agent_deposit_request | boundary_mismatch | occupied_property_misrepresented | other
    description = Column(Text, nullable=False)
    status = Column(String(32), nullable=False, default="open")  # open | reviewed_by_admin | dismissed
    admin_notes = Column(Text, nullable=True)
    reviewed_by_admin_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_at = Column(String(32), nullable=False, default=utcnow_iso)



