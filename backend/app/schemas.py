from typing import List, Optional
from pydantic import BaseModel, Field


class GpsSampleInput(BaseModel):
    lat: float
    lon: float
    accuracy_m: float
    timestamp_ms: Optional[int] = None


class GpsCornerAggregateRequest(BaseModel):
    samples: List[GpsSampleInput]
    max_accuracy_m: Optional[float] = None


class VertexInput(BaseModel):
    lat: float
    lon: float
    accuracy_m: Optional[float] = None
    kept_samples: Optional[int] = 1


class GeometryPreviewRequest(BaseModel):
    vertices: List[VertexInput]
    sqm_per_plot: float = Field(..., gt=0, description="Configurable sqm per plot for this listing")
    measurement_method: str = Field(..., pattern="^(gps_walk|satellite_trace|surveyor_plan)$")
    declared_area_m2: Optional[float] = None


class PlotCreateRequest(BaseModel):
    title: str = Field(..., min_length=3)
    description: str = Field(..., min_length=5)
    state: str = Field(..., min_length=2)
    lga: str = Field(..., min_length=2)
    area_name: str = Field(..., min_length=2)
    purpose: str = Field(..., pattern="^(sale|lease|construction)$")
    asking_price: float = Field(..., ge=0)
    currency: str = Field(default="NGN", pattern="^(NGN|USD)$")
    declared_area_m2: Optional[float] = None
    sqm_per_plot: float = Field(..., gt=0)
    measurement_method: str = Field(..., pattern="^(gps_walk|satellite_trace|surveyor_plan)$")
    vertices: List[VertexInput]
    is_occupied_home: bool = False


class DocumentStatusUpdateRequest(BaseModel):
    status: str
    admin_notes: Optional[str] = None
    external_report_id: Optional[str] = None


class FlagReviewRequest(BaseModel):
    status: str = Field(..., pattern="^(open|reviewed_by_admin|dismissed)$")
    admin_notes: Optional[str] = None


class PhotoBase64UploadRequest(BaseModel):
    capture_source: str = Field(..., pattern="^(in_app|uploaded)$")
    filename: str = "evidence.jpg"
    mime_type: str = "image/jpeg"
    image_base64: str
    lat: float
    lon: float
    gps_accuracy_m: float = 5.0
    client_captured_at: Optional[str] = None


class DocumentBase64UploadRequest(BaseModel):
    category: str = Field(
        ...,
        pattern="^(survey_plan|title_document|governors_consent|deed_of_assignment|external_report|other)$",
    )
    title: str
    filename: str = "document.pdf"
    mime_type: str = "application/pdf"
    file_base64: str
    plan_number: Optional[str] = None
    surveyor_name: Optional[str] = None
    surveyor_reg_no: Optional[str] = None
    stated_area_m2: Optional[float] = None


# ==============================================================================
# PART C (PHASE 2): BUILT HOUSES & APARTMENTS SCHEMAS
# ==============================================================================


class RoomDimensionInput(BaseModel):
    room_name: str = Field(..., min_length=2)
    length_m: float = Field(..., gt=0)
    width_m: float = Field(..., gt=0)
    height_m: float = Field(default=3.0, gt=0)
    measurement_source: str = Field(default="manual", pattern="^(manual|webxr_experimental)$")


class PropertyUnitCreateInput(BaseModel):
    unit_name: str = Field(..., min_length=2)
    floor_number: int = 0
    bedrooms: int = Field(default=1, ge=0)
    bathrooms: int = Field(default=1, ge=0)
    power_meter_type: str = "prepaid"
    power_disco: str = "IKEDC"
    water_source: str = "borehole_treatment"
    drainage_flood_notes: str = ""
    security_features: str = ""
    declared_area_m2: Optional[float] = None
    occupancy_status: str = Field(
        default="vacant", pattern="^(vacant|tenant_occupied|owner_occupied|under_renovation)$"
    )
    lease_start_date: Optional[str] = None
    lease_end_date: Optional[str] = None
    rooms: List[RoomDimensionInput] = []


class BuildingCreateRequest(BaseModel):
    plot_id: Optional[str] = None
    title: str = Field(..., min_length=3)
    property_type: str = Field(..., pattern="^(house|duplex|block_of_flats|single_unit)$")
    address: str = Field(..., min_length=3)
    state: str = Field(..., min_length=2)
    lga: str = Field(..., min_length=2)
    storeys: int = Field(default=1, ge=1)
    year_built: Optional[int] = None
    measurement_method: str = Field(
        default="gps_walk", pattern="^(gps_walk|satellite_trace|surveyor_plan)$"
    )
    footprint_vertices: List[VertexInput]
    entrance_lat: float
    entrance_lon: float
    is_occupied_home: bool = True
    reinspection_interval_days: int = Field(default=90, ge=7)
    units: List[PropertyUnitCreateInput] = []


class ConditionItemInput(BaseModel):
    category: str
    rating: str = Field(..., pattern="^(good|fair|poor|not_checked)$")
    notes: str = ""
    photo_ids: List[str] = []


class ConditionChecklistCreateRequest(BaseModel):
    unit_id: Optional[str] = None
    items: List[ConditionItemInput]


class AgentAuthorizeRequest(BaseModel):
    agent_id: str


class UnitListingCreateRequest(BaseModel):
    listing_type: str = Field(default="rent", pattern="^(sale|rent|short_let)$")
    asking_price: float = Field(..., gt=0)
    currency: str = Field(default="NGN", pattern="^(NGN|USD)$")


class OwnershipClaimCreateRequest(BaseModel):
    claim_type: str = Field(
        ...,
        pattern="^(initial_claim|transfer_of_interest|lease_status_update|encumbrance_note)$",
    )
    summary: str = Field(..., min_length=5)
    document_ref: str = Field(..., min_length=3)


class MonitoringEntryCreateRequest(BaseModel):
    entry_type: str = Field(
        default="construction_milestone",
        pattern="^(construction_milestone|maintenance_log|reinspection_check)$",
    )
    stage_label: str = Field(..., min_length=2)
    notes: str = Field(..., min_length=3)
    lat: float
    lon: float
    photo_sha256: Optional[str] = None


# ==============================================================================
# PART D (PHASE 3): TRUST LAYER SCHEMAS (D1 - D6)
# ==============================================================================


class InspectionRequestCreate(BaseModel):
    target_type: str = Field(..., pattern="^(plot|building)$")
    target_id: str = Field(..., min_length=2)
    requester_note: str = ""
    is_diaspora_requester: bool = False


class InspectionAssignRequest(BaseModel):
    inspector_id: str = Field(..., min_length=2)


class InspectionStartRequest(BaseModel):
    inspector_lat: float
    inspector_lon: float
    max_geofence_m: Optional[float] = None


class InspectionMediaItem(BaseModel):
    media_type: str = Field(default="photo", pattern="^(photo|video)$")
    capture_source: str = Field(default="in_app", pattern="^(in_app|uploaded)$")
    captured_at: str
    lat: float
    lon: float
    sha256_hash: str


class InspectionSubmitReportRequest(BaseModel):
    report_summary: str = Field(..., min_length=5)
    checklist_items: List[ConditionItemInput]
    media: List[InspectionMediaItem] = []


class InspectionRateRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    review_comment: str = ""


class AgentProfileSubmitRequest(BaseModel):
    registration_body: str = Field(..., min_length=2)  # e.g., LASRERA, NIESV, ESVARBON
    registration_number: str = Field(..., min_length=3)
    id_document_filename: str = "agent_id.pdf"
    id_document_mime_type: str = "application/pdf"
    id_document_base64: str = Field(..., min_length=4)


class AgentAdminCheckRequest(BaseModel):
    outcome: str = Field(..., pattern="^(checked_ok|mismatch_noted)$")
    checked_on_date: str = Field(..., min_length=8)  # YYYY-MM-DD
    admin_notes: str = ""


class PaymentReceiptCreateRequest(BaseModel):
    target_type: str = Field(..., pattern="^(plot|building|unit)$")
    target_id: str = Field(..., min_length=2)
    stage: str = Field(
        ..., pattern="^(deposit|rent|purchase_instalment|final_balance)$"
    )
    amount: float = Field(..., gt=0)
    currency: str = Field(default="NGN", pattern="^(NGN|USD)$")
    payment_date: str = Field(..., min_length=8)
    payment_method: str = Field(
        default="bank_transfer",
        pattern="^(bank_transfer|manager_cheque|escrow_transfer)$",
    )
    bank_reference: str = Field(..., min_length=3)
    payer_name: str = Field(..., min_length=2)
    payee_name: str = Field(..., min_length=2)
    receipt_base64: Optional[str] = None
    receipt_mime_type: str = "application/pdf"


class PaymentReceiptConfirmDisputeRequest(BaseModel):
    party_role: str = Field(..., pattern="^(buyer|seller)$")
    decision: str = Field(..., pattern="^(confirmed|disputed)$")
    notes: Optional[str] = None


class SuspiciousReportCreateRequest(BaseModel):
    target_type: str = Field(..., pattern="^(plot|building|unit)$")
    target_id: str = Field(..., min_length=2)
    reason_category: str = Field(
        ...,
        pattern="^(possible_duplicate_claim|unverified_agent_deposit_request|boundary_mismatch|occupied_property_misrepresented|other)$",
    )
    description: str = Field(..., min_length=5)



