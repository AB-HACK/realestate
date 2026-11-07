import os
import sys
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import Base, install_append_only_audit_triggers
from app.main import (
    authorize_agent_for_unit,
    create_building,
    create_condition_checklist,
    create_monitoring_entry,
    create_ownership_claim,
    create_plot,
    create_unit_listing,
)
from app.models import ConflictingListingClaim, UnitListing, User
from app.schemas import (
    AgentAuthorizeRequest,
    BuildingCreateRequest,
    ConditionChecklistCreateRequest,
    ConditionItemInput,
    MonitoringEntryCreateRequest,
    OwnershipClaimCreateRequest,
    PlotCreateRequest,
    PropertyUnitCreateInput,
    RoomDimensionInput,
    UnitListingCreateRequest,
    VertexInput,
)
from app.services.audit import verify_audit_chain
from app.services.geometry import (
    check_footprint_inside_plot,
    evaluate_room_areas_vs_declared,
    make_rectangle_near,
)


@pytest.fixture()
def db_session():
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    Base.metadata.create_all(bind=test_engine)
    install_append_only_audit_triggers(test_engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine, future=True)
    db = TestingSession()

    # Seed users for Phase 2 RBAC tests
    db.add_all(
        [
            User(
                id="usr-owner-1",
                email="owner@aecren.ng",
                password_hash="demo",
                first_name="Tunde",
                last_name="Bakare",
                role="owner",
            ),
            User(
                id="usr-agent-1",
                email="agent@aecren.ng",
                password_hash="demo",
                first_name="Chinedu",
                last_name="Okafor",
                role="agent",
            ),
            User(
                id="usr-inspector-1",
                email="inspector@aecren.ng",
                password_hash="demo",
                first_name="Ibrahim",
                last_name="Musa",
                role="inspector",
            ),
            User(
                id="usr-admin-1",
                email="admin@aecren.ng",
                password_hash="demo",
                first_name="Amina",
                last_name="Yusuf",
                role="admin",
            ),
        ]
    )
    db.commit()

    try:
        yield db
    finally:
        db.close()


def test_acceptance_footprint_inside_plot(db_session):
    """
    Part C Acceptance #2:
    The building footprint polygon must fall inside the linked plot polygon, otherwise flag.
    """
    owner_actor = {"id": "usr-owner-1", "role": "owner"}

    # Create a 30m x 20m parent plot near Ibadan (7.38 N, 3.90 E)
    plot_coords = make_rectangle_near(7.3800, 3.9000, width_east_m=30.0, height_north_m=20.0)
    plot_res = create_plot(
        req=PlotCreateRequest(
            title="Parent Plot for Building Containment Test",
            description="30m x 20m plot in Ibadan",
            state="Oyo",
            lga="Ibadan North",
            area_name="Bodija",
            purpose="construction",
            asking_price=40_000_000,
            currency="NGN",
            sqm_per_plot=600.0,
            measurement_method="gps_walk",
            vertices=[VertexInput(lat=lat, lon=lon, accuracy_m=2.0) for lon, lat in plot_coords],
        ),
        actor=owner_actor,
        db=db_session,
    )
    parent_plot_id = plot_res["id"]

    # Case A: Building footprint (12m x 10m) strictly INSIDE the 30m x 20m parent plot
    inside_fp_coords = make_rectangle_near(7.3800, 3.9000, width_east_m=12.0, height_north_m=10.0)
    check_in = check_footprint_inside_plot(inside_fp_coords, plot_coords)
    assert check_in["footprint_inside_plot"] is True
    assert check_in["outside_ratio"] == 0.0

    bld_inside = create_building(
        req=BuildingCreateRequest(
            plot_id=parent_plot_id,
            title="4-Bedroom Detached Duplex (Inside Plot)",
            property_type="duplex",
            address="Plot 14 Awolowo Ave, Bodija",
            state="Oyo",
            lga="Ibadan North",
            storeys=2,
            year_built=2025,
            measurement_method="gps_walk",
            footprint_vertices=[
                VertexInput(lat=lat, lon=lon, accuracy_m=2.0) for lon, lat in inside_fp_coords
            ],
            entrance_lat=7.38001,
            entrance_lon=3.90001,
            units=[],
        ),
        actor=owner_actor,
        db=db_session,
    )
    assert bld_inside["footprint_inside_plot"] is True

    # Case B: Building footprint protruding OUTSIDE the eastern edge of the parent plot
    outside_fp_coords = make_rectangle_near(7.3800, 3.90020, width_east_m=25.0, height_north_m=10.0)
    check_out = check_footprint_inside_plot(outside_fp_coords, plot_coords)
    assert check_out["footprint_inside_plot"] is False
    assert check_out["outside_ratio"] > 0.30

    bld_outside = create_building(
        req=BuildingCreateRequest(
            plot_id=parent_plot_id,
            title="Protruding Structure (Outside Plot Boundary)",
            property_type="house",
            address="Plot 14B Awolowo Ave, Bodija",
            state="Oyo",
            lga="Ibadan North",
            storeys=1,
            measurement_method="satellite_trace",
            footprint_vertices=[
                VertexInput(lat=lat, lon=lon, accuracy_m=3.5) for lon, lat in outside_fp_coords
            ],
            entrance_lat=7.38001,
            entrance_lon=3.90022,
            units=[],
        ),
        actor=owner_actor,
        db=db_session,
    )
    assert bld_outside["footprint_inside_plot"] is False
    assert bld_outside["footprint_outside_ratio"] > 0.30


def test_acceptance_room_area_sum_vs_declared_unit_area():
    """
    Part C Acceptance #3 (C2):
    Flag if the sum of room areas differs from the declared unit area by more than 20% (configurable).
    """
    rooms = [
        {"room_name": "Living & Dining Room", "length_m": 6.0, "width_m": 5.0, "height_m": 3.0},  # 30 m2
        {"room_name": "Master Bedroom", "length_m": 5.0, "width_m": 4.0, "height_m": 3.0},        # 20 m2
        {"room_name": "Bedroom 2", "length_m": 4.0, "width_m": 4.0, "height_m": 3.0},             # 16 m2
        {"room_name": "Kitchen & Store", "length_m": 4.0, "width_m": 3.5, "height_m": 3.0},       # 14 m2
    ]
    # Sum of room areas = 30 + 20 + 16 + 14 = 80.0 m2

    # 1. Declared unit area = 90 m2 -> diff is 10 / 90 = 11.11% (<= 20%) -> NOT flagged
    res_ok = evaluate_room_areas_vs_declared(rooms, declared_unit_area_m2=90.0)
    assert res_ok["computed_room_area_sum_m2"] == 80.0
    assert res_ok["room_area_discrepancy_flagged"] is False
    assert res_ok["room_area_diff_pct"] == pytest.approx(11.11, abs=0.05)

    # 2. Declared unit area = 130 m2 -> diff is 50 / 130 = 38.46% (> 20%) -> FLAGGED
    res_flagged = evaluate_room_areas_vs_declared(rooms, declared_unit_area_m2=130.0)
    assert res_flagged["computed_room_area_sum_m2"] == 80.0
    assert res_flagged["room_area_discrepancy_flagged"] is True
    assert res_flagged["room_area_diff_pct"] > 20.0


def test_acceptance_db_level_uniqueness_and_one_active_listing_rule(db_session):
    """
    Part C Acceptance #1 (C5):
    - A unit can have only one active primary listing (enforced both in app logic and at DB level).
    - A second unauthorized attempt is blocked (409) and routed to Admin as a conflicting claim.
    - Owners can explicitly authorise agents, and an authorised agent's listing links to the owner's.
    """
    owner_actor = {"id": "usr-owner-1", "role": "owner"}
    unauth_agent_actor = {"id": "usr-agent-1", "role": "agent"}

    fp_coords = make_rectangle_near(6.4474, 3.4723, width_east_m=15.0, height_north_m=12.0)
    bld = create_building(
        req=BuildingCreateRequest(
            plot_id=None,
            title="Lekki Phase 1 Block of 4 Flats",
            property_type="block_of_flats",
            address="12 Admiralty Way, Lekki Phase 1",
            state="Lagos",
            lga="Eti-Osa",
            storeys=2,
            measurement_method="gps_walk",
            footprint_vertices=[
                VertexInput(lat=lat, lon=lon, accuracy_m=2.5) for lon, lat in fp_coords
            ],
            entrance_lat=6.44742,
            entrance_lon=3.47235,
            units=[
                PropertyUnitCreateInput(
                    unit_name="Flat 1A (Ground Floor)",
                    floor_number=0,
                    bedrooms=3,
                    bathrooms=3,
                    power_meter_type="prepaid",
                    power_disco="EKEDC",
                    water_source="borehole_treatment",
                    declared_area_m2=110.0,
                    rooms=[
                        RoomDimensionInput(room_name="Living Room", length_m=7.0, width_m=5.0),
                        RoomDimensionInput(room_name="Bedrooms & Kitchen", length_m=12.0, width_m=6.0),
                    ],
                )
            ],
        ),
        actor=owner_actor,
        db=db_session,
    )
    unit_id = bld["units"][0]["id"]

    # 1. Owner creates the primary active listing for Flat 1A
    primary_lst = create_unit_listing(
        unit_id=unit_id,
        req=UnitListingCreateRequest(listing_type="rent", asking_price=6_500_000, currency="NGN"),
        actor=owner_actor,
        db=db_session,
    )
    assert primary_lst["status"] == "active"
    assert primary_lst["is_primary_active"] is True

    # 2. Unauthorized agent tries to create a second active listing on the same unit -> Blocked (409) & routed to Admin
    with pytest.raises(HTTPException) as exc_info:
        create_unit_listing(
            unit_id=unit_id,
            req=UnitListingCreateRequest(listing_type="rent", asking_price=7_000_000, currency="NGN"),
            actor=unauth_agent_actor,
            db=db_session,
        )
    assert exc_info.value.status_code == 409
    assert exc_info.value.detail["error"] == "one_active_listing_rule_violation"

    # Confirm the conflicting claim was persisted for Admin review
    claims = db_session.query(ConflictingListingClaim).filter_by(unit_id=unit_id).all()
    assert len(claims) == 1
    assert claims[0].status == "open"

    # 3. Verify DB-level partial unique index `ix_one_active_primary_listing_per_unit`:
    # Attempting to bypass the endpoint and insert a second active primary listing directly into SQLite MUST raise IntegrityError!
    duplicate_db_row = UnitListing(
        unit_id=unit_id,
        building_id=bld["id"],
        lister_id="usr-agent-1",
        lister_role="agent",
        listing_type="rent",
        asking_price=7_000_000,
        currency="NGN",
        status="active",
        is_primary_active=True,
    )
    db_session.add(duplicate_db_row)
    with pytest.raises(IntegrityError):
        db_session.flush()
    db_session.rollback()

    # 4. Owner explicitly authorizes `usr-agent-1` -> agent's listing now links cleanly to owner's primary listing
    authorize_agent_for_unit(
        unit_id=unit_id,
        req=AgentAuthorizeRequest(agent_id="usr-agent-1"),
        actor=owner_actor,
        db=db_session,
    )
    linked_lst = create_unit_listing(
        unit_id=unit_id,
        req=UnitListingCreateRequest(listing_type="rent", asking_price=6_500_000, currency="NGN"),
        actor=unauth_agent_actor,
        db=db_session,
    )
    assert linked_lst["status"] == "active"
    assert linked_lst["is_primary_active"] is False
    assert linked_lst["linked_owner_listing_id"] == primary_lst["id"]


def test_condition_checklist_labels_and_ownership_and_monitoring_timeline(db_session):
    """
    Tests C3 ('self-declared' vs 'inspected by <inspector>'), C6 (ownership claims),
    C7 (monitoring timeline linking plot -> building), and audit hash chain integrity.
    """
    owner_actor = {"id": "usr-owner-1", "role": "owner"}
    inspector_actor = {"id": "usr-inspector-1", "role": "inspector"}

    plot_coords = make_rectangle_near(7.3800, 3.9000, width_east_m=30.0, height_north_m=20.0)
    parent_plot = create_plot(
        req=PlotCreateRequest(
            title="Bodija Plot for Construction Monitoring",
            description="30m x 20m plot in Bodija",
            state="Oyo",
            lga="Ibadan North",
            area_name="Bodija",
            purpose="construction",
            asking_price=35_000_000,
            currency="NGN",
            sqm_per_plot=600.0,
            measurement_method="gps_walk",
            vertices=[VertexInput(lat=lat, lon=lon, accuracy_m=2.0) for lon, lat in plot_coords],
        ),
        actor=owner_actor,
        db=db_session,
    )

    fp_coords = make_rectangle_near(7.3800, 3.9000, width_east_m=10.0, height_north_m=10.0)
    bld = create_building(
        req=BuildingCreateRequest(
            plot_id=parent_plot["id"],
            title="Bodija Semi-Detached Villa",
            property_type="duplex",
            address="8 Awolowo Way, Old Bodija",
            state="Oyo",
            lga="Ibadan North",
            storeys=2,
            footprint_vertices=[
                VertexInput(lat=lat, lon=lon, accuracy_m=2.0) for lon, lat in fp_coords
            ],
            entrance_lat=7.38001,
            entrance_lon=3.90001,
            units=[],
        ),
        actor=owner_actor,
        db=db_session,
    )
    bld_id = bld["id"]

    # Owner submits checklist -> must be labelled 'self-declared'
    chk_owner = create_condition_checklist(
        building_id=bld_id,
        req=ConditionChecklistCreateRequest(
            items=[
                ConditionItemInput(category="roof", rating="good", notes="Long-span aluminum dry"),
                ConditionItemInput(category="electrical", rating="good", notes="Prepaid meter"),
            ]
        ),
        actor=owner_actor,
        db=db_session,
    )
    assert chk_owner["declaration_label"] == "self-declared"

    # Inspector submits checklist -> must be labelled 'inspected by <inspector>'
    chk_insp = create_condition_checklist(
        building_id=bld_id,
        req=ConditionChecklistCreateRequest(
            items=[
                ConditionItemInput(category="roof", rating="good", notes="Verified no roof leak"),
                ConditionItemInput(category="walls_cracks", rating="fair", notes="Hairline plaster crack"),
            ]
        ),
        actor=inspector_actor,
        db=db_session,
    )
    assert chk_insp["declaration_label"] == "inspected by Ibrahim Musa"

    # C6: Submit ownership claim
    claim = create_ownership_claim(
        building_id=bld_id,
        req=OwnershipClaimCreateRequest(
            claim_type="transfer_of_interest",
            summary="Registered Deed of Assignment from Bakare Estate to Buyer",
            document_ref="OY-DEED-2026-9912",
        ),
        actor=owner_actor,
        db=db_session,
    )
    assert claim["status"] == "under_review"

    # C7: Add dated geotagged construction/maintenance monitoring entry linking plot -> building
    mon = create_monitoring_entry(
        building_id=bld_id,
        req=MonitoringEntryCreateRequest(
            entry_type="construction_milestone",
            stage_label="Roofing & Parapet Cast Completed",
            notes="Geotagged site inspection of roof trusses and parapet.",
            lat=7.38001,
            lon=3.90001,
            photo_sha256="a91f3c8e0192b4d6e8f1234567890abcdef1234567890abcdef1234567890ab1",
        ),
        actor=inspector_actor,
        db=db_session,
    )
    assert mon["plot_id"] == parent_plot["id"]
    assert mon["building_id"] == bld_id

    # Verify audit chain remains 100% intact across all Phase 2 events
    verify_res = verify_audit_chain(db_session)
    assert verify_res["valid"] is True
