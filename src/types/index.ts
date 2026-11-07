export type UserRole =
  | 'visitor'
  | 'buyer_renter'
  | 'owner'
  | 'agent'
  | 'inspector'
  | 'admin';

export type EvidenceStatus =
  | 'not_provided'
  | 'uploaded'
  | 'under_review'
  | 'reviewed_by_admin'
  | 'externally_verified';

export type MeasurementMethod =
  | 'gps_walk'
  | 'satellite_trace'
  | 'surveyor_plan';

export type PlotPurpose = 'sale' | 'lease' | 'construction';

export type CurrencyCode = 'NGN' | 'USD';

export type DocumentType =
  | 'survey_plan'
  | 'title_document'
  | 'governors_consent'
  | 'deed_of_assignment'
  | 'other';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  ndpa_consent_at: string;
  agent_reg_body?: string;
  agent_reg_number?: string;
  agent_checked_at?: string;
}

export interface PlotVertex {
  lat: number;
  lon: number;
  accuracy_m: number;
  sample_count?: number;
}

export interface EvidencePhotoItem {
  id: string;
  plot_id: string;
  caption: string;
  capture_source: 'captured_in_app' | 'uploaded';
  lat: number;
  lon: number;
  gps_accuracy_m: number;
  distance_to_polygon_m: number;
  within_geofence: boolean;
  client_captured_at: string;
  server_received_at: string;
  sha256_hash: string;
  perceptual_hash: string;
  reused_across_listings: boolean;
  preview_url: string;
}

export interface DocumentChecklistItem {
  id: string;
  plot_id: string;
  doc_type: DocumentType;
  title: string;
  status: EvidenceStatus;
  file_name?: string;
  admin_notes?: string;
  external_report_ref?: string;
  updated_at: string;
}

export interface SpatialFlagItem {
  id: string;
  plot_id: string;
  conflicting_plot_id: string;
  flag_type: 'possible_overlap' | 'possible_duplicate';
  overlap_pct: number;
  centroid_distance_m: number;
  area_diff_pct: number;
  status: 'open' | 'resolved_confirmed_conflict' | 'resolved_benign';
  admin_notes?: string;
  created_at: string;
}

export interface PlotRecord {
  id: string;
  owner_id: string;
  owner_name: string;
  owner_role: UserRole;
  title: string;
  description: string;
  state: string;
  lga: string;
  area_name: string;
  purpose: PlotPurpose;
  asking_price: number;
  currency: CurrencyCode;
  declared_area_m2?: number;
  sqm_per_plot: number;
  measurement_method: MeasurementMethod;
  vertices: PlotVertex[];
  computed_area_m2: number;
  computed_perimeter_m: number;
  area_low_m2: number;
  area_high_m2: number;
  computed_area_hectares: number;
  computed_area_acres: number;
  computed_area_plots: number;
  mean_vertex_accuracy_m: number;
  is_occupied_home: boolean;
  survey_plan_number?: string;
  surveyor_name?: string;
  surveyor_reg_number?: string;
  stated_surveyor_area_m2?: number;
  surveyor_discrepancy_pct?: number;
  surveyor_discrepancy_flagged?: boolean;
  agent_badge_text?: string;
  photos: EvidencePhotoItem[];
  documents: DocumentChecklistItem[];
  spatial_flags: SpatialFlagItem[];
  created_at: string;
}

export interface AuditEventItem {
  seq: number;
  entity_type: string;
  entity_id: string;
  actor_id: string;
  event_type: string;
  payload_json: string;
  created_at: string;
  prev_hash: string;
  hash: string;
}

export interface AuditVerificationResult {
  valid: boolean;
  checked_count: number;
  first_mismatch_seq: number | null;
  mismatch_reason: string | null;
  description: string;
}

// ============================================================================
// PART C (PHASE 2): BUILT HOUSES & APARTMENTS TYPES (C1 - C7)
// ============================================================================

export type BuiltPropertyType = 'house' | 'duplex' | 'block_of_flats' | 'single_unit';

export type ConditionCategory =
  | 'roof'
  | 'ceiling'
  | 'walls_cracks'
  | 'floors'
  | 'doors_windows'
  | 'electrical'
  | 'plumbing'
  | 'water_supply'
  | 'drainage_flooding'
  | 'fence_gate'
  | 'access_road';

export type ConditionRating = 'good' | 'fair' | 'poor' | 'not_checked';

export type OccupancyStatus =
  | 'vacant'
  | 'tenant_occupied'
  | 'owner_occupied'
  | 'under_renovation';

export interface RoomDimensionItem {
  id: string;
  room_name: string;
  length_m: number;
  width_m: number;
  height_m: number;
  computed_area_m2: number;
  measurement_source: 'manual' | 'webxr_experimental';
}

export interface ConditionItem {
  category: ConditionCategory;
  rating: ConditionRating;
  notes: string;
}

export interface ConditionChecklistRecord {
  id: string;
  building_id: string;
  unit_id?: string;
  author_id: string;
  author_name: string;
  author_role: UserRole;
  declaration_label: string; // "self-declared" | "inspected by <inspector>"
  items: ConditionItem[];
  created_at: string;
}

export interface BuildingPhotoItem {
  id: string;
  building_id: string;
  unit_id?: string;
  room_name?: string; // undefined/null = Exterior
  caption: string;
  capture_source: 'captured_in_app' | 'uploaded';
  lat: number;
  lon: number;
  gps_accuracy_m: number;
  distance_to_building_m: number;
  within_geofence: boolean;
  client_captured_at: string;
  server_received_at: string;
  sha256_hash: string;
  perceptual_hash: string;
  reused_across_listings: boolean;
  preview_url: string;
}

export interface AgentAuthorizationItem {
  id: string;
  unit_id: string;
  owner_id: string;
  agent_id: string;
  agent_name: string;
  status: 'active' | 'revoked';
  created_at: string;
}

export interface UnitListingItem {
  id: string;
  unit_id: string;
  building_id: string;
  lister_id: string;
  lister_name: string;
  lister_role: UserRole;
  listing_type: 'sale' | 'rent' | 'short_let';
  asking_price: number;
  currency: CurrencyCode;
  status: 'active' | 'closed';
  is_primary_active: boolean;
  linked_owner_listing_id?: string;
  created_at: string;
}

export interface ConflictingListingClaimItem {
  id: string;
  unit_id: string;
  building_id: string;
  unit_name: string;
  building_title: string;
  existing_listing_id: string;
  claimant_id: string;
  claimant_name: string;
  claimant_role: UserRole;
  attempted_price: number;
  currency: CurrencyCode;
  reason: string;
  status: 'open' | 'resolved_by_admin';
  admin_notes?: string;
  created_at: string;
}

export interface PropertyUnitRecord {
  id: string;
  building_id: string;
  unit_name: string;
  floor_number: number;
  bedrooms: number;
  bathrooms: number;
  power_meter_type: 'prepaid' | 'postpaid' | 'solar_hybrid' | 'generator_only';
  power_disco: string;
  water_source: string;
  drainage_flood_notes: string;
  security_features: string;
  declared_area_m2?: number;
  computed_room_area_sum_m2: number;
  room_area_diff_pct: number;
  room_area_discrepancy_flagged: boolean;
  occupancy_status: OccupancyStatus;
  lease_start_date?: string;
  lease_end_date?: string;
  rooms: RoomDimensionItem[];
  active_listings: UnitListingItem[];
  authorized_agents: AgentAuthorizationItem[];
  conflicting_claims: ConflictingListingClaimItem[];
}

export interface OwnershipClaimItem {
  id: string;
  building_id: string;
  claimant_id: string;
  claimant_name: string;
  claim_type:
    | 'initial_claim'
    | 'transfer_of_interest'
    | 'lease_status_update'
    | 'encumbrance_note';
  summary: string;
  document_ref: string;
  status: EvidenceStatus;
  admin_notes?: string;
  created_at: string;
}

export interface MonitoringEntryItem {
  id: string;
  plot_id?: string;
  building_id: string;
  author_id: string;
  author_name: string;
  entry_type: 'construction_milestone' | 'maintenance_log' | 'reinspection_check';
  stage_label: string;
  notes: string;
  lat: number;
  lon: number;
  photo_url?: string;
  photo_sha256?: string;
  captured_at: string;
}

export interface BuildingRecord {
  id: string;
  owner_id: string;
  owner_name: string;
  owner_role: UserRole;
  plot_id?: string;
  title: string;
  property_type: BuiltPropertyType;
  address: string;
  state: string;
  lga: string;
  storeys: number;
  year_built?: number;
  measurement_method: MeasurementMethod;
  footprint_vertices: PlotVertex[];
  footprint_area_m2: number;
  footprint_area_low_m2: number;
  footprint_area_high_m2: number;
  footprint_perimeter_m: number;
  mean_vertex_accuracy_m: number;
  entrance_lat: number;
  entrance_lon: number;
  is_occupied_home: boolean;
  footprint_inside_plot: boolean;
  footprint_outside_pct: number;
  reinspection_interval_days: number;
  next_reinspection_due_at: string;
  units: PropertyUnitRecord[];
  checklists: ConditionChecklistRecord[];
  photos: BuildingPhotoItem[];
  ownership_claims: OwnershipClaimItem[];
  monitoring_entries: MonitoringEntryItem[];
  created_at: string;
}

// ============================================================================
// PART D (PHASE 3): TRUST LAYER TYPES (D1 - D6)
// ============================================================================

export type InspectionTargetType = 'plot' | 'building';

export type InspectionJobStatus =
  | 'requested'
  | 'assigned'
  | 'in_progress'
  | 'completed';

export interface InspectionMediaCapture {
  id: string;
  media_type: 'photo' | 'video';
  capture_source: 'in_app' | 'uploaded';
  caption: string;
  captured_at: string;
  lat: number;
  lon: number;
  sha256_hash: string;
  preview_url: string;
}

export interface InspectionJobRecord {
  id: string;
  target_type: InspectionTargetType;
  target_id: string;
  target_title: string;
  target_state: string;
  target_lga: string;
  target_lat: number;
  target_lon: number;
  requester_id: string;
  requester_name: string;
  requester_role: UserRole;
  is_diaspora_requester: boolean;
  requester_note: string;
  assigned_inspector_id?: string;
  assigned_inspector_name?: string;
  status: InspectionJobStatus;
  inspector_start_lat?: number;
  inspector_start_lon?: number;
  distance_to_target_m?: number;
  within_start_geofence?: boolean;
  report_summary?: string;
  checklist_items: ConditionItem[];
  media: InspectionMediaCapture[];
  immutable_audit_hash?: string;
  buyer_rating?: number;
  buyer_review_comment?: string;
  requested_at: string;
  assigned_at?: string;
  started_at?: string;
  completed_at?: string;
}

export interface AgentVerificationProfile {
  id: string;
  agent_id: string;
  agent_name: string;
  agent_email: string;
  registration_body: 'LASRERA' | 'NIESV' | 'ESVARBON' | 'REDAN' | string;
  registration_number: string;
  id_document_filename: string;
  id_document_sha256: string;
  status: EvidenceStatus;
  outcome: 'pending' | 'checked_ok' | 'mismatch_noted';
  checked_by_admin_id?: string;
  checked_on_date?: string;
  admin_notes?: string;
  badge_text: string;
  updated_at: string;
}

export type PaymentStage =
  | 'deposit'
  | 'rent'
  | 'purchase_instalment'
  | 'final_balance';

export type PaymentPartyStatus = 'pending' | 'confirmed' | 'disputed';

export interface ProofOfPaymentReceiptItem {
  id: string;
  target_type: 'plot' | 'building';
  target_id: string;
  target_title: string;
  uploaded_by_id: string;
  uploaded_by_name: string;
  uploaded_by_role: UserRole;
  stage: PaymentStage;
  amount: number;
  currency: CurrencyCode;
  payment_date: string;
  payment_method: 'bank_transfer' | 'manager_cheque' | 'escrow_transfer';
  bank_reference: string;
  payer_name: string;
  payee_name: string;
  receipt_file_name: string;
  receipt_sha256: string;
  buyer_status: PaymentPartyStatus;
  seller_status: PaymentPartyStatus;
  dispute_notes?: string;
  audit_event_hash: string;
  created_at: string;
  updated_at: string;
}

export type SuspiciousReasonCategory =
  | 'possible_duplicate_claim'
  | 'unverified_agent_deposit_request'
  | 'boundary_mismatch'
  | 'occupied_property_misrepresented'
  | 'other';

export interface SuspiciousReportItem {
  id: string;
  target_type: 'plot' | 'building';
  target_id: string;
  target_title: string;
  reporter_id: string;
  reporter_name: string;
  reporter_role: UserRole;
  reason_category: SuspiciousReasonCategory;
  description: string;
  status: 'open' | 'reviewed_by_admin' | 'dismissed';
  admin_notes?: string;
  created_at: string;
}

export interface PriceBenchmarkComparable {
  id: string;
  title: string;
  state: string;
  lga: string;
  distance_km: number;
  area_m2: number;
  price_ngn: number;
  price_per_m2_ngn: number;
  price_per_m2_usd: number;
}

export interface PriceBenchmarkResult {
  target_id: string;
  target_type: 'plot' | 'building';
  status: 'ok' | 'insufficient_data';
  status_label: string;
  indicative_disclaimer: string;
  radius_km: number;
  required_minimum_comps: number;
  comparable_count: number;
  target_price_per_m2_ngn: number;
  target_price_per_m2_usd: number;
  percentile_band: {
    p5_ngn: number;
    q1_ngn: number;
    median_ngn: number;
    q3_ngn: number;
    p95_ngn: number;
    p5_usd: number;
    q1_usd: number;
    median_usd: number;
    q3_usd: number;
    p95_usd: number;
    percentile_rank: number;
  } | null;
  is_extreme_outlier: boolean;
  outlier_direction: 'below_p5' | 'above_p95' | 'within_p5_p95' | null;
  comparables: PriceBenchmarkComparable[];
}


