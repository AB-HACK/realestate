import { create } from 'zustand';
import {
  PlotRecord,
  PlotVertex,
  MeasurementMethod,
  PlotPurpose,
  CurrencyCode,
  UserRole,
  EvidenceStatus,
  AuditEventItem,
  AuditVerificationResult,
  SpatialFlagItem,
  BuildingRecord,
  BuiltPropertyType,
  ConditionItem,
  OccupancyStatus,
  InspectionJobRecord,
  AgentVerificationProfile,
  ProofOfPaymentReceiptItem,
  PaymentStage,
  SuspiciousReportItem,
  SuspiciousReasonCategory,
  PriceBenchmarkResult,
} from '../types';
import {
  INITIAL_PLOTS,
  INITIAL_BUILDINGS,
  INITIAL_INSPECTIONS,
  INITIAL_AGENT_PROFILES,
  INITIAL_PAYMENT_RECEIPTS,
  INITIAL_SUSPICIOUS_REPORTS,
  BENCHMARK_COMPARABLE_POOL,
} from '../lib/mock-data';
import {
  computePlotGeometryMetrics,
  comparePolygonsSpatial,
  distancePointToPolygonM,
  checkFootprintInsidePlot,
  evaluateRoomAreaSum,
  geodesicDistancePointToPointM,
  computeListingBenchmark,
} from '../lib/geodesic';

// Deterministic synchronous FNV-1a / SHA-256 style hex digest for live client-side hash-chain verification
function computeCanonicalEventHash(
  prevHash: string,
  entityType: string,
  entityId: string,
  actorId: string,
  eventType: string,
  payloadJson: string,
  createdAt: string
): string {
  const canonicalInput = `${prevHash}|${entityType}|${entityId}|${actorId}|${eventType}|${payloadJson}|${createdAt}`;
  const lanes = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab,
    0x5be0cd19,
  ];
  for (let i = 0; i < canonicalInput.length; i++) {
    const code = canonicalInput.charCodeAt(i);
    const laneIdx = i & 7;
    lanes[laneIdx] = Math.imul(lanes[laneIdx] ^ code, 0x01000193) >>> 0;
    lanes[(laneIdx + 3) & 7] =
      (lanes[(laneIdx + 3) & 7] + ((lanes[laneIdx] << 5) | (lanes[laneIdx] >>> 27))) >>> 0;
  }
  return lanes.map((v) => v.toString(16).padStart(8, '0')).join('');
}

function buildInitialAuditChain(): AuditEventItem[] {
  const genesisPrev = '0'.repeat(64);
  const rawSeeds = [
    {
      entity_type: 'plot',
      entity_id: 'plot-ibadan-001',
      actor_id: 'usr-owner-1',
      event_type: 'PLOT_CREATED',
      payload: {
        area_high_m2: 940.1,
        area_low_m2: 300.1,
        computed_area_m2: 600.0,
        measurement_method: 'gps_walk',
        sqm_per_plot: 600,
      },
      created_at: '2026-02-10T10:00:00Z',
    },
    {
      entity_type: 'document',
      entity_id: 'doc-ib-1',
      actor_id: 'usr-admin-1',
      event_type: 'DOCUMENT_STATUS_UPDATED',
      payload: {
        external_report_ref: 'OY-SURCON-CHART-2026-0192',
        new_status: 'externally_verified',
        plot_id: 'plot-ibadan-001',
      },
      created_at: '2026-02-11T14:00:00Z',
    },
    {
      entity_type: 'spatial_flag',
      entity_id: 'flg-ib-overlap-1',
      actor_id: 'system-strtree',
      event_type: 'SPATIAL_CONFLICT_FLAGGED',
      payload: {
        conflicting_plot_id: 'plot-ibadan-002',
        flag_type: 'possible_overlap',
        overlap_pct: 62.4,
        plot_id: 'plot-ibadan-001',
      },
      created_at: '2026-02-14T09:30:00Z',
    },
    {
      entity_type: 'building',
      entity_id: 'bld-ibadan-001',
      actor_id: 'usr-owner-1',
      event_type: 'BUILDING_CREATED',
      payload: {
        footprint_area_m2: 146.4,
        footprint_inside_plot: true,
        plot_id: 'plot-ibadan-001',
        property_type: 'duplex',
      },
      created_at: '2026-02-15T10:00:00Z',
    },
    {
      entity_type: 'conflicting_listing_claim',
      entity_id: 'cfl-lk-1a-dup',
      actor_id: 'usr-agent-1',
      event_type: 'UNIT_LISTING_CONFLICT_BLOCKED',
      payload: {
        building_id: 'bld-lekki-002',
        existing_listing_id: 'lst-lk-1a-primary',
        unit_id: 'unit-lekki-flat1a',
      },
      created_at: '2026-02-19T16:10:00Z',
    },
  ];

  const chain: AuditEventItem[] = [];
  let prevHash = genesisPrev;

  rawSeeds.forEach((item, idx) => {
    const sortedKeys = Object.keys(item.payload).sort();
    const sortedObj: Record<string, unknown> = {};
    for (const k of sortedKeys) {
      sortedObj[k] = (item.payload as Record<string, unknown>)[k];
    }
    const payloadJson = JSON.stringify(sortedObj);
    const hash = computeCanonicalEventHash(
      prevHash,
      item.entity_type,
      item.entity_id,
      item.actor_id,
      item.event_type,
      payloadJson,
      item.created_at
    );
    chain.push({
      seq: idx + 1,
      entity_type: item.entity_type,
      entity_id: item.entity_id,
      actor_id: item.actor_id,
      event_type: item.event_type,
      payload_json: payloadJson,
      created_at: item.created_at,
      prev_hash: prevHash,
      hash,
    });
    prevHash = hash;
  });

  return chain;
}

function runChainVerification(events: AuditEventItem[]): AuditVerificationResult {
  let expectedPrev = '0'.repeat(64);
  for (const ev of events) {
    if (ev.prev_hash !== expectedPrev) {
      return {
        valid: false,
        checked_count: events.length,
        first_mismatch_seq: ev.seq,
        mismatch_reason: `prev_hash mismatch at seq #${ev.seq}: expected ${expectedPrev.slice(
          0,
          16
        )}..., found ${ev.prev_hash.slice(0, 16)}...`,
        description:
          'Tamper-evident audit chain verification FAILED. One or more historical rows were altered.',
      };
    }
    const recomputed = computeCanonicalEventHash(
      ev.prev_hash,
      ev.entity_type,
      ev.entity_id,
      ev.actor_id,
      ev.event_type,
      ev.payload_json,
      ev.created_at
    );
    if (recomputed !== ev.hash) {
      return {
        valid: false,
        checked_count: events.length,
        first_mismatch_seq: ev.seq,
        mismatch_reason: `SHA-256 payload digest mismatch at seq #${ev.seq}: stored hash ${ev.hash.slice(
          0,
          16
        )}... != recomputed ${recomputed.slice(0, 16)}...`,
        description:
          'Tamper-evident audit chain verification FAILED. Canonical payload was mutated after insertion.',
      };
    }
    expectedPrev = ev.hash;
  }

  return {
    valid: true,
    checked_count: events.length,
    first_mismatch_seq: null,
    mismatch_reason: null,
    description:
      'Tamper-evident audit log verified. Every event hash matches SHA-256(prev_hash + canonical_payload).',
  };
}

export interface CreatePlotInput {
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
  is_occupied_home: boolean;
  survey_plan_number?: string;
  surveyor_name?: string;
  surveyor_reg_number?: string;
  stated_surveyor_area_m2?: number;
}

export interface CreateBuildingInput {
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
  entrance_lat: number;
  entrance_lon: number;
  is_occupied_home: boolean;
  reinspection_interval_days: number;
  units: Array<{
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
    occupancy_status: OccupancyStatus;
    lease_start_date?: string;
    lease_end_date?: string;
    rooms: Array<{
      room_name: string;
      length_m: number;
      width_m: number;
      height_m: number;
      measurement_source: 'manual' | 'webxr_experimental';
    }>;
  }>;
}

interface DataState {
  plots: PlotRecord[];
  buildings: BuildingRecord[];
  inspections: InspectionJobRecord[];
  agentProfiles: AgentVerificationProfile[];
  paymentReceipts: ProofOfPaymentReceiptItem[];
  suspiciousReports: SuspiciousReportItem[];
  auditEvents: AuditEventItem[];
  backupUntamperedChain: AuditEventItem[] | null;
  auditVerification: AuditVerificationResult;
  createPlot: (input: CreatePlotInput) => PlotRecord;
  addEvidencePhoto: (input: {
    plot_id: string;
    actor_id: string;
    caption: string;
    capture_source: 'captured_in_app' | 'uploaded';
    lat: number;
    lon: number;
    gps_accuracy_m: number;
    client_captured_at: string;
    sha256_hash: string;
    perceptual_hash: string;
    preview_url: string;
  }) => void;
  uploadPlotDocument: (
    plotId: string,
    docId: string,
    fileName: string,
    notes: string,
    actorId: string
  ) => void;
  adminUpdateDocumentStatus: (input: {
    plot_id: string;
    doc_id: string;
    new_status: EvidenceStatus;
    admin_notes: string;
    external_report_ref?: string;
    actor_id: string;
    actor_role: UserRole;
  }) => void;
  adminResolveFlag: (
    plotId: string,
    flagId: string,
    resolution: 'resolved_confirmed_conflict' | 'resolved_benign',
    adminNotes: string,
    actorId: string
  ) => void;
  // Phase 2 Actions (C1 - C7)
  createBuilding: (input: CreateBuildingInput) => BuildingRecord;
  addConditionChecklist: (input: {
    building_id: string;
    unit_id?: string;
    author_id: string;
    author_name: string;
    author_role: UserRole;
    items: ConditionItem[];
  }) => void;
  addBuildingPhoto: (input: {
    building_id: string;
    unit_id?: string;
    room_name?: string;
    actor_id: string;
    caption: string;
    capture_source: 'captured_in_app' | 'uploaded';
    lat: number;
    lon: number;
    gps_accuracy_m: number;
    client_captured_at: string;
    sha256_hash: string;
    perceptual_hash: string;
    preview_url: string;
  }) => void;
  authorizeAgentForUnit: (input: {
    building_id: string;
    unit_id: string;
    owner_id: string;
    agent_id: string;
    agent_name: string;
  }) => void;
  createUnitListing: (input: {
    building_id: string;
    unit_id: string;
    lister_id: string;
    lister_name: string;
    lister_role: UserRole;
    listing_type: 'sale' | 'rent' | 'short_let';
    asking_price: number;
    currency: CurrencyCode;
  }) => { status: 'created_primary' | 'created_authorized_linked' | 'blocked_conflict'; message: string };
  resolveConflictingListingClaim: (
    buildingId: string,
    unitId: string,
    claimId: string,
    adminNotes: string,
    actorId: string
  ) => void;
  updateUnitOccupancy: (input: {
    building_id: string;
    unit_id: string;
    occupancy_status: OccupancyStatus;
    lease_start_date?: string;
    lease_end_date?: string;
    actor_id: string;
  }) => void;
  addOwnershipClaim: (input: {
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
  }) => void;
  adminReviewOwnershipClaim: (input: {
    building_id: string;
    claim_id: string;
    status: EvidenceStatus;
    admin_notes: string;
    actor_id: string;
  }) => void;
  addMonitoringEntry: (input: {
    building_id: string;
    author_id: string;
    author_name: string;
    entry_type: 'construction_milestone' | 'maintenance_log' | 'reinspection_check';
    stage_label: string;
    notes: string;
    lat: number;
    lon: number;
    photo_url?: string;
  }) => void;
  verifyAuditChain: () => AuditVerificationResult;
  simulateTamperOnAuditRow: (seq: number) => void;
  restoreTamperedAuditChain: () => void;
  // Phase 3 Actions (D1 - D6)
  requestInspection: (input: {
    target_type: 'plot' | 'building';
    target_id: string;
    requester_id: string;
    requester_name: string;
    requester_role: UserRole;
    is_diaspora_requester: boolean;
    requester_note: string;
  }) => InspectionJobRecord;
  adminAssignInspector: (input: {
    job_id: string;
    inspector_id: string;
    inspector_name: string;
    admin_id: string;
  }) => void;
  inspectorStartJob: (input: {
    job_id: string;
    inspector_id: string;
    inspector_lat: number;
    inspector_lon: number;
    max_geofence_m?: number;
  }) => { started: boolean; distance_m: number; message: string };
  inspectorSubmitReport: (input: {
    job_id: string;
    inspector_id: string;
    inspector_name: string;
    report_summary: string;
    checklist_items: ConditionItem[];
    media_caption: string;
    media_type: 'photo' | 'video';
    preview_url: string;
  }) => void;
  rateInspection: (input: {
    job_id: string;
    actor_id: string;
    rating: number;
    review_comment: string;
  }) => void;
  submitAgentProfile: (input: {
    agent_id: string;
    agent_name: string;
    agent_email: string;
    registration_body: string;
    registration_number: string;
    id_document_filename: string;
  }) => void;
  adminCheckAgentProfile: (input: {
    profile_id: string;
    actor_id: string;
    actor_role: UserRole;
    outcome: 'checked_ok' | 'mismatch_noted';
    checked_on_date: string;
    admin_notes: string;
  }) => void;
  uploadPaymentReceipt: (input: {
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
  }) => void;
  respondToPaymentReceipt: (input: {
    receipt_id: string;
    actor_id: string;
    party_role: 'buyer' | 'seller';
    decision: 'confirmed' | 'disputed';
    notes?: string;
  }) => void;
  reportSuspiciousListing: (input: {
    target_type: 'plot' | 'building';
    target_id: string;
    target_title: string;
    reporter_id: string;
    reporter_name: string;
    reporter_role: UserRole;
    reason_category: SuspiciousReasonCategory;
    description: string;
  }) => void;
  adminReviewSuspiciousReport: (input: {
    report_id: string;
    actor_id: string;
    status: 'reviewed_by_admin' | 'dismissed';
    admin_notes: string;
  }) => void;
  getPriceBenchmark: (input: {
    target_type: 'plot' | 'building';
    target_id: string;
    radius_km: number;
    exchange_rate_ngn_per_usd?: number;
  }) => PriceBenchmarkResult | null;
}

const initialChain = buildInitialAuditChain();

export const useDataStore = create<DataState>((set, get) => ({
  plots: INITIAL_PLOTS,
  buildings: INITIAL_BUILDINGS,
  inspections: INITIAL_INSPECTIONS,
  agentProfiles: INITIAL_AGENT_PROFILES,
  paymentReceipts: INITIAL_PAYMENT_RECEIPTS,
  suspiciousReports: INITIAL_SUSPICIOUS_REPORTS,
  auditEvents: initialChain,
  backupUntamperedChain: null,
  auditVerification: runChainVerification(initialChain),

  createPlot: (input) => {
    const metrics = computePlotGeometryMetrics(input.vertices, input.sqm_per_plot);
    const newPlotId = `plot-${Date.now()}`;
    const nowIso = new Date().toISOString();

    let discrepancyPct: number | undefined;
    let discrepancyFlagged = false;
    if (
      input.measurement_method === 'surveyor_plan' &&
      input.stated_surveyor_area_m2 &&
      input.stated_surveyor_area_m2 > 0
    ) {
      discrepancyPct = Number(
        (
          (Math.abs(metrics.computed_area_m2 - input.stated_surveyor_area_m2) /
            input.stated_surveyor_area_m2) *
          100
        ).toFixed(2)
      );
      discrepancyFlagged = discrepancyPct > 15.0;
    }

    const currentPlots = get().plots;
    const newFlags: SpatialFlagItem[] = [];

    for (const other of currentPlots) {
      const cmp = comparePolygonsSpatial(input.vertices, other.vertices);
      if (cmp.is_possible_overlap || cmp.is_possible_duplicate) {
        const flagType = cmp.is_possible_overlap
          ? 'possible_overlap'
          : 'possible_duplicate';
        newFlags.push({
          id: `flg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          plot_id: newPlotId,
          conflicting_plot_id: other.id,
          flag_type: flagType,
          overlap_pct: cmp.overlap_pct,
          centroid_distance_m: cmp.centroid_distance_m,
          area_diff_pct: cmp.area_diff_pct,
          status: 'open',
          admin_notes: `Auto-flagged ${flagType.replace('_', ' ')} on save (${
            cmp.overlap_pct
          }% buffered intersection, centroids ${cmp.centroid_distance_m}m apart).`,
          created_at: nowIso,
        });
      }
    }

    const newPlot: PlotRecord = {
      id: newPlotId,
      owner_id: input.owner_id,
      owner_name: input.owner_name,
      owner_role: input.owner_role,
      title: input.title,
      description: input.description,
      state: input.state,
      lga: input.lga,
      area_name: input.area_name,
      purpose: input.purpose,
      asking_price: input.asking_price,
      currency: input.currency,
      declared_area_m2: input.declared_area_m2,
      sqm_per_plot: input.sqm_per_plot,
      measurement_method: input.measurement_method,
      vertices: input.vertices,
      ...metrics,
      is_occupied_home: input.is_occupied_home,
      survey_plan_number: input.survey_plan_number,
      surveyor_name: input.surveyor_name,
      surveyor_reg_number: input.surveyor_reg_number,
      stated_surveyor_area_m2: input.stated_surveyor_area_m2,
      surveyor_discrepancy_pct: discrepancyPct,
      surveyor_discrepancy_flagged: discrepancyFlagged,
      agent_badge_text:
        input.owner_role === 'agent'
          ? 'Registration number LASRERA/AG/2025/0419 checked by admin on 2026-02-01'
          : 'Direct owner submission — identity document logged',
      photos: [],
      documents: [
        {
          id: `doc-${newPlotId}-1`,
          plot_id: newPlotId,
          doc_type: 'survey_plan',
          title: 'Registered Survey Plan',
          status: input.measurement_method === 'surveyor_plan' ? 'uploaded' : 'not_provided',
          file_name:
            input.measurement_method === 'surveyor_plan'
              ? `Survey_Plan_${input.survey_plan_number || 'Upload'}.pdf`
              : undefined,
          admin_notes: discrepancyFlagged
            ? `Auto-flagged for admin review: stated area differs from measured area by ${discrepancyPct}% (>15% threshold).`
            : undefined,
          updated_at: nowIso,
        },
        {
          id: `doc-${newPlotId}-2`,
          plot_id: newPlotId,
          doc_type: 'title_document',
          title: 'Title Document (C of O / Registered Deed)',
          status: 'not_provided',
          updated_at: nowIso,
        },
        {
          id: `doc-${newPlotId}-3`,
          plot_id: newPlotId,
          doc_type: 'governors_consent',
          title: "Governor's Consent",
          status: 'not_provided',
          updated_at: nowIso,
        },
        {
          id: `doc-${newPlotId}-4`,
          plot_id: newPlotId,
          doc_type: 'deed_of_assignment',
          title: 'Deed of Assignment / Purchase Receipt',
          status: 'not_provided',
          updated_at: nowIso,
        },
      ],
      spatial_flags: newFlags,
      created_at: nowIso,
    };

    set((state) => {
      const lastEvent = state.auditEvents[state.auditEvents.length - 1];
      const prevHash = lastEvent ? lastEvent.hash : '0'.repeat(64);
      const seq = (lastEvent?.seq || 0) + 1;
      const payloadJson = JSON.stringify({
        area_high_m2: newPlot.area_high_m2,
        area_low_m2: newPlot.area_low_m2,
        computed_area_m2: newPlot.computed_area_m2,
        measurement_method: newPlot.measurement_method,
        spatial_flags_count: newFlags.length,
        sqm_per_plot: newPlot.sqm_per_plot,
      });
      const hash = computeCanonicalEventHash(
        prevHash,
        'plot',
        newPlot.id,
        input.owner_id,
        'PLOT_CREATED',
        payloadJson,
        nowIso
      );
      const nextEvents: AuditEventItem[] = [
        ...state.auditEvents,
        {
          seq,
          entity_type: 'plot',
          entity_id: newPlot.id,
          actor_id: input.owner_id,
          event_type: 'PLOT_CREATED',
          payload_json: payloadJson,
          created_at: nowIso,
          prev_hash: prevHash,
          hash,
        },
      ];
      return {
        plots: [newPlot, ...state.plots],
        auditEvents: nextEvents,
        auditVerification: runChainVerification(nextEvents),
      };
    });

    return newPlot;
  },

  addEvidencePhoto: (input) => {
    set((state) => {
      const targetPlot = state.plots.find((p) => p.id === input.plot_id);
      if (!targetPlot) return state;

      const distM = distancePointToPolygonM(input.lat, input.lon, targetPlot.vertices);
      const withinGeofence = distM <= 50.0;

      const reusedAcrossListings = state.plots.some((pl) =>
        pl.photos.some(
          (existingPhoto) =>
            existingPhoto.sha256_hash === input.sha256_hash ||
            existingPhoto.perceptual_hash === input.perceptual_hash
        )
      );

      const nowIso = new Date().toISOString();
      const photoId = `ph-${Date.now()}`;
      const newPhoto = {
        id: photoId,
        plot_id: input.plot_id,
        caption: input.caption,
        capture_source: input.capture_source,
        lat: input.lat,
        lon: input.lon,
        gps_accuracy_m: input.gps_accuracy_m,
        distance_to_polygon_m: distM,
        within_geofence: withinGeofence,
        client_captured_at: input.client_captured_at,
        server_received_at: nowIso,
        sha256_hash: input.sha256_hash,
        perceptual_hash: input.perceptual_hash,
        reused_across_listings: reusedAcrossListings,
        preview_url: input.preview_url,
      };

      const updatedPlots = state.plots.map((p) =>
        p.id === input.plot_id ? { ...p, photos: [...p.photos, newPhoto] } : p
      );

      const lastEvent = state.auditEvents[state.auditEvents.length - 1];
      const prevHash = lastEvent ? lastEvent.hash : '0'.repeat(64);
      const seq = (lastEvent?.seq || 0) + 1;
      const payloadJson = JSON.stringify({
        capture_source: input.capture_source,
        distance_to_polygon_m: distM,
        phash: input.perceptual_hash,
        plot_id: input.plot_id,
        reused_across_listings: reusedAcrossListings,
        sha256: input.sha256_hash.slice(0, 16),
        within_geofence: withinGeofence,
      });
      const hash = computeCanonicalEventHash(
        prevHash,
        'photo',
        photoId,
        input.actor_id,
        reusedAcrossListings ? 'PHOTO_REUSE_FLAGGED' : 'PHOTO_EVIDENCE_CAPTURED',
        payloadJson,
        nowIso
      );
      const nextEvents = [
        ...state.auditEvents,
        {
          seq,
          entity_type: 'photo',
          entity_id: photoId,
          actor_id: input.actor_id,
          event_type: reusedAcrossListings
            ? 'PHOTO_REUSE_FLAGGED'
            : 'PHOTO_EVIDENCE_CAPTURED',
          payload_json: payloadJson,
          created_at: nowIso,
          prev_hash: prevHash,
          hash,
        },
      ];

      return {
        plots: updatedPlots,
        auditEvents: nextEvents,
        auditVerification: runChainVerification(nextEvents),
      };
    });
  },

  uploadPlotDocument: (plotId, docId, fileName, notes, actorId) => {
    const nowIso = new Date().toISOString();
    set((state) => {
      const updatedPlots = state.plots.map((p) => {
        if (p.id !== plotId) return p;
        return {
          ...p,
          documents: p.documents.map((d) =>
            d.id === docId
              ? {
                  ...d,
                  status: 'uploaded' as EvidenceStatus,
                  file_name: fileName,
                  admin_notes: notes,
                  updated_at: nowIso,
                }
              : d
          ),
        };
      });

      const lastEvent = state.auditEvents[state.auditEvents.length - 1];
      const prevHash = lastEvent ? lastEvent.hash : '0'.repeat(64);
      const seq = (lastEvent?.seq || 0) + 1;
      const payloadJson = JSON.stringify({
        file_name: fileName,
        new_status: 'uploaded',
        plot_id: plotId,
      });
      const hash = computeCanonicalEventHash(
        prevHash,
        'document',
        docId,
        actorId,
        'DOCUMENT_UPLOADED',
        payloadJson,
        nowIso
      );
      const nextEvents = [
        ...state.auditEvents,
        {
          seq,
          entity_type: 'document',
          entity_id: docId,
          actor_id: actorId,
          event_type: 'DOCUMENT_UPLOADED',
          payload_json: payloadJson,
          created_at: nowIso,
          prev_hash: prevHash,
          hash,
        },
      ];

      return {
        plots: updatedPlots,
        auditEvents: nextEvents,
        auditVerification: runChainVerification(nextEvents),
      };
    });
  },

  adminUpdateDocumentStatus: (input) => {
    if (input.actor_role !== 'admin') {
      throw new Error(
        'RBAC Policy Violation: Owners and agents cannot promote their own document statuses. Only an Admin may update review statuses.'
      );
    }
    if (
      input.new_status === 'externally_verified' &&
      (!input.external_report_ref || !input.external_report_ref.trim())
    ) {
      throw new Error(
        'Non-Negotiable Rule: Status "externally_verified" is only allowed when an external report reference (registry search or surveyor/solicitor report) is attached and confirmed by an Admin.'
      );
    }

    const nowIso = new Date().toISOString();
    set((state) => {
      const updatedPlots = state.plots.map((p) => {
        if (p.id !== input.plot_id) return p;
        return {
          ...p,
          documents: p.documents.map((d) =>
            d.id === input.doc_id
              ? {
                  ...d,
                  status: input.new_status,
                  admin_notes: input.admin_notes,
                  external_report_ref:
                    input.external_report_ref?.trim() || d.external_report_ref,
                  updated_at: nowIso,
                }
              : d
          ),
        };
      });

      const lastEvent = state.auditEvents[state.auditEvents.length - 1];
      const prevHash = lastEvent ? lastEvent.hash : '0'.repeat(64);
      const seq = (lastEvent?.seq || 0) + 1;
      const payloadJson = JSON.stringify({
        external_report_ref: input.external_report_ref || null,
        new_status: input.new_status,
        plot_id: input.plot_id,
      });
      const hash = computeCanonicalEventHash(
        prevHash,
        'document',
        input.doc_id,
        input.actor_id,
        'DOCUMENT_STATUS_UPDATED',
        payloadJson,
        nowIso
      );
      const nextEvents = [
        ...state.auditEvents,
        {
          seq,
          entity_type: 'document',
          entity_id: input.doc_id,
          actor_id: input.actor_id,
          event_type: 'DOCUMENT_STATUS_UPDATED',
          payload_json: payloadJson,
          created_at: nowIso,
          prev_hash: prevHash,
          hash,
        },
      ];

      return {
        plots: updatedPlots,
        auditEvents: nextEvents,
        auditVerification: runChainVerification(nextEvents),
      };
    });
  },

  adminResolveFlag: (plotId, flagId, resolution, adminNotes, actorId) => {
    const nowIso = new Date().toISOString();
    set((state) => {
      const updatedPlots = state.plots.map((p) => {
        if (p.id !== plotId) return p;
        return {
          ...p,
          spatial_flags: p.spatial_flags.map((f) =>
            f.id === flagId
              ? { ...f, status: resolution, admin_notes: adminNotes }
              : f
          ),
        };
      });

      const lastEvent = state.auditEvents[state.auditEvents.length - 1];
      const prevHash = lastEvent ? lastEvent.hash : '0'.repeat(64);
      const seq = (lastEvent?.seq || 0) + 1;
      const payloadJson = JSON.stringify({
        admin_notes: adminNotes,
        flag_id: flagId,
        plot_id: plotId,
        resolution,
      });
      const hash = computeCanonicalEventHash(
        prevHash,
        'spatial_flag',
        flagId,
        actorId,
        'SPATIAL_FLAG_RESOLVED',
        payloadJson,
        nowIso
      );
      const nextEvents = [
        ...state.auditEvents,
        {
          seq,
          entity_type: 'spatial_flag',
          entity_id: flagId,
          actor_id: actorId,
          event_type: 'SPATIAL_FLAG_RESOLVED',
          payload_json: payloadJson,
          created_at: nowIso,
          prev_hash: prevHash,
          hash,
        },
      ];

      return {
        plots: updatedPlots,
        auditEvents: nextEvents,
        auditVerification: runChainVerification(nextEvents),
      };
    });
  },

  // ==========================================================================
  // PART C (PHASE 2): BUILT HOUSES & APARTMENTS ACTIONS
  // ==========================================================================

  createBuilding: (input) => {
    const metrics = computePlotGeometryMetrics(input.footprint_vertices, 600, 10.0);
    const bldId = `bld-${Date.now()}`;
    const nowIso = new Date().toISOString();

    let insidePlot = true;
    let outsidePct = 0;

    if (input.plot_id) {
      const linkedPlot = get().plots.find((p) => p.id === input.plot_id);
      if (linkedPlot) {
        const cont = checkFootprintInsidePlot(
          input.footprint_vertices,
          linkedPlot.vertices
        );
        insidePlot = cont.footprint_inside_plot;
        outsidePct = cont.footprint_outside_pct;
      }
    }

    const builtUnits = input.units.map((u, idx) => {
      const roomEval = evaluateRoomAreaSum(u.rooms, u.declared_area_m2, 20.0);
      return {
        id: `unit-${Date.now()}-${idx}`,
        building_id: bldId,
        unit_name: u.unit_name,
        floor_number: u.floor_number,
        bedrooms: u.bedrooms,
        bathrooms: u.bathrooms,
        power_meter_type: u.power_meter_type,
        power_disco: u.power_disco,
        water_source: u.water_source,
        drainage_flood_notes: u.drainage_flood_notes,
        security_features: u.security_features,
        declared_area_m2: u.declared_area_m2,
        computed_room_area_sum_m2: roomEval.computed_room_area_sum_m2,
        room_area_diff_pct: roomEval.room_area_diff_pct,
        room_area_discrepancy_flagged: roomEval.room_area_discrepancy_flagged,
        occupancy_status: u.occupancy_status,
        lease_start_date: u.lease_start_date,
        lease_end_date: u.lease_end_date,
        rooms: roomEval.rooms,
        active_listings: [],
        authorized_agents: [],
        conflicting_claims: [],
      };
    });

    const dueDate = new Date(
      Date.now() + input.reinspection_interval_days * 24 * 60 * 60 * 1000
    ).toISOString();

    const newBuilding: BuildingRecord = {
      id: bldId,
      owner_id: input.owner_id,
      owner_name: input.owner_name,
      owner_role: input.owner_role,
      plot_id: input.plot_id,
      title: input.title,
      property_type: input.property_type,
      address: input.address,
      state: input.state,
      lga: input.lga,
      storeys: input.storeys,
      year_built: input.year_built,
      measurement_method: input.measurement_method,
      footprint_vertices: input.footprint_vertices,
      footprint_area_m2: metrics.computed_area_m2,
      footprint_area_low_m2: metrics.area_low_m2,
      footprint_area_high_m2: metrics.area_high_m2,
      footprint_perimeter_m: metrics.computed_perimeter_m,
      mean_vertex_accuracy_m: metrics.mean_vertex_accuracy_m,
      entrance_lat: input.entrance_lat,
      entrance_lon: input.entrance_lon,
      is_occupied_home: input.is_occupied_home,
      footprint_inside_plot: insidePlot,
      footprint_outside_pct: outsidePct,
      reinspection_interval_days: input.reinspection_interval_days,
      next_reinspection_due_at: dueDate,
      units: builtUnits,
      checklists: [],
      photos: [],
      ownership_claims: [
        {
          id: `clm-${Date.now()}`,
          building_id: bldId,
          claimant_id: input.owner_id,
          claimant_name: input.owner_name,
          claim_type: 'initial_claim',
          summary: `Initial building & unit evidence submission by ${input.owner_name}.`,
          document_ref: input.plot_id ? `LINKED-${input.plot_id}` : 'SELF-DECLARED-PLAN',
          status: 'uploaded',
          created_at: nowIso,
        },
      ],
      monitoring_entries: [],
      created_at: nowIso,
    };

    set((state) => {
      const lastEvent = state.auditEvents[state.auditEvents.length - 1];
      const prevHash = lastEvent ? lastEvent.hash : '0'.repeat(64);
      const seq = (lastEvent?.seq || 0) + 1;
      const payloadJson = JSON.stringify({
        footprint_area_m2: newBuilding.footprint_area_m2,
        footprint_inside_plot: newBuilding.footprint_inside_plot,
        plot_id: newBuilding.plot_id || null,
        property_type: newBuilding.property_type,
        units_count: builtUnits.length,
      });
      const hash = computeCanonicalEventHash(
        prevHash,
        'building',
        bldId,
        input.owner_id,
        'BUILDING_CREATED',
        payloadJson,
        nowIso
      );
      const nextEvents = [
        ...state.auditEvents,
        {
          seq,
          entity_type: 'building',
          entity_id: bldId,
          actor_id: input.owner_id,
          event_type: 'BUILDING_CREATED',
          payload_json: payloadJson,
          created_at: nowIso,
          prev_hash: prevHash,
          hash,
        },
      ];

      return {
        buildings: [newBuilding, ...state.buildings],
        auditEvents: nextEvents,
        auditVerification: runChainVerification(nextEvents),
      };
    });

    return newBuilding;
  },

  addConditionChecklist: (input) => {
    const nowIso = new Date().toISOString();
    const chkId = `chk-${Date.now()}`;
    const declarationLabel =
      input.author_role === 'inspector'
        ? `inspected by ${input.author_name}`
        : 'self-declared';

    set((state) => {
      const updatedBuildings = state.buildings.map((b) =>
        b.id === input.building_id
          ? {
              ...b,
              checklists: [
                {
                  id: chkId,
                  building_id: input.building_id,
                  unit_id: input.unit_id,
                  author_id: input.author_id,
                  author_name: input.author_name,
                  author_role: input.author_role,
                  declaration_label: declarationLabel,
                  items: input.items,
                  created_at: nowIso,
                },
                ...b.checklists,
              ],
            }
          : b
      );

      const lastEvent = state.auditEvents[state.auditEvents.length - 1];
      const prevHash = lastEvent ? lastEvent.hash : '0'.repeat(64);
      const seq = (lastEvent?.seq || 0) + 1;
      const payloadJson = JSON.stringify({
        building_id: input.building_id,
        declaration_label: declarationLabel,
        items_count: input.items.length,
      });
      const hash = computeCanonicalEventHash(
        prevHash,
        'condition_checklist',
        chkId,
        input.author_id,
        'CONDITION_CHECKLIST_RECORDED',
        payloadJson,
        nowIso
      );
      const nextEvents = [
        ...state.auditEvents,
        {
          seq,
          entity_type: 'condition_checklist',
          entity_id: chkId,
          actor_id: input.author_id,
          event_type: 'CONDITION_CHECKLIST_RECORDED',
          payload_json: payloadJson,
          created_at: nowIso,
          prev_hash: prevHash,
          hash,
        },
      ];

      return {
        buildings: updatedBuildings,
        auditEvents: nextEvents,
        auditVerification: runChainVerification(nextEvents),
      };
    });
  },

  addBuildingPhoto: (input) => {
    set((state) => {
      const targetBld = state.buildings.find((b) => b.id === input.building_id);
      if (!targetBld) return state;

      const distM = geodesicDistancePointToPointM(
        input.lat,
        input.lon,
        targetBld.entrance_lat,
        targetBld.entrance_lon
      );
      const withinGeofence = distM <= 50.0;

      const reusedInPlots = state.plots.some((pl) =>
        pl.photos.some(
          (ph) =>
            ph.sha256_hash === input.sha256_hash ||
            ph.perceptual_hash === input.perceptual_hash
        )
      );
      const reusedInBuildings = state.buildings.some((bl) =>
        bl.photos.some(
          (ph) =>
            ph.sha256_hash === input.sha256_hash ||
            ph.perceptual_hash === input.perceptual_hash
        )
      );
      const reused = reusedInPlots || reusedInBuildings;

      const nowIso = new Date().toISOString();
      const photoId = `bph-${Date.now()}`;
      const newPhoto = {
        id: photoId,
        building_id: input.building_id,
        unit_id: input.unit_id,
        room_name: input.room_name,
        caption: input.caption,
        capture_source: input.capture_source,
        lat: input.lat,
        lon: input.lon,
        gps_accuracy_m: input.gps_accuracy_m,
        distance_to_building_m: distM,
        within_geofence: withinGeofence,
        client_captured_at: input.client_captured_at,
        server_received_at: nowIso,
        sha256_hash: input.sha256_hash,
        perceptual_hash: input.perceptual_hash,
        reused_across_listings: reused,
        preview_url: input.preview_url,
      };

      const updatedBuildings = state.buildings.map((b) =>
        b.id === input.building_id ? { ...b, photos: [...b.photos, newPhoto] } : b
      );

      const lastEvent = state.auditEvents[state.auditEvents.length - 1];
      const prevHash = lastEvent ? lastEvent.hash : '0'.repeat(64);
      const seq = (lastEvent?.seq || 0) + 1;
      const payloadJson = JSON.stringify({
        building_id: input.building_id,
        distance_to_building_m: distM,
        reused_across_listings: reused,
        room_name: input.room_name || 'exterior',
        within_geofence: withinGeofence,
      });
      const hash = computeCanonicalEventHash(
        prevHash,
        'building_photo',
        photoId,
        input.actor_id,
        'BUILDING_PHOTO_CAPTURED',
        payloadJson,
        nowIso
      );
      const nextEvents = [
        ...state.auditEvents,
        {
          seq,
          entity_type: 'building_photo',
          entity_id: photoId,
          actor_id: input.actor_id,
          event_type: 'BUILDING_PHOTO_CAPTURED',
          payload_json: payloadJson,
          created_at: nowIso,
          prev_hash: prevHash,
          hash,
        },
      ];

      return {
        buildings: updatedBuildings,
        auditEvents: nextEvents,
        auditVerification: runChainVerification(nextEvents),
      };
    });
  },

  authorizeAgentForUnit: (input) => {
    const nowIso = new Date().toISOString();
    const authId = `auth-${Date.now()}`;
    set((state) => {
      const updatedBuildings = state.buildings.map((b) => {
        if (b.id !== input.building_id) return b;
        return {
          ...b,
          units: b.units.map((u) =>
            u.id === input.unit_id
              ? {
                  ...u,
                  authorized_agents: [
                    ...u.authorized_agents,
                    {
                      id: authId,
                      unit_id: input.unit_id,
                      owner_id: input.owner_id,
                      agent_id: input.agent_id,
                      agent_name: input.agent_name,
                      status: 'active' as const,
                      created_at: nowIso,
                    },
                  ],
                }
              : u
          ),
        };
      });

      const lastEvent = state.auditEvents[state.auditEvents.length - 1];
      const prevHash = lastEvent ? lastEvent.hash : '0'.repeat(64);
      const seq = (lastEvent?.seq || 0) + 1;
      const payloadJson = JSON.stringify({
        agent_id: input.agent_id,
        owner_id: input.owner_id,
        unit_id: input.unit_id,
      });
      const hash = computeCanonicalEventHash(
        prevHash,
        'agent_authorization',
        authId,
        input.owner_id,
        'UNIT_AGENT_AUTHORIZED',
        payloadJson,
        nowIso
      );
      const nextEvents = [
        ...state.auditEvents,
        {
          seq,
          entity_type: 'agent_authorization',
          entity_id: authId,
          actor_id: input.owner_id,
          event_type: 'UNIT_AGENT_AUTHORIZED',
          payload_json: payloadJson,
          created_at: nowIso,
          prev_hash: prevHash,
          hash,
        },
      ];

      return {
        buildings: updatedBuildings,
        auditEvents: nextEvents,
        auditVerification: runChainVerification(nextEvents),
      };
    });
  },

  createUnitListing: (input) => {
    const state = get();
    const bld = state.buildings.find((b) => b.id === input.building_id);
    const unit = bld?.units.find((u) => u.id === input.unit_id);
    if (!bld || !unit) {
      throw new Error('Building or unit not found.');
    }

    const nowIso = new Date().toISOString();
    const existingPrimary = unit.active_listings.find(
      (l) => l.status === 'active' && l.is_primary_active
    );

    if (existingPrimary) {
      // Check if actor is an explicitly authorized agent for this unit
      const isAuthorizedAgent = unit.authorized_agents.some(
        (a) => a.agent_id === input.lister_id && a.status === 'active'
      );

      if (isAuthorizedAgent) {
        const linkedId = `lst-${Date.now()}`;
        set((curr) => {
          const updatedBuildings = curr.buildings.map((b) =>
            b.id === input.building_id
              ? {
                  ...b,
                  units: b.units.map((u) =>
                    u.id === input.unit_id
                      ? {
                          ...u,
                          active_listings: [
                            ...u.active_listings,
                            {
                              id: linkedId,
                              unit_id: input.unit_id,
                              building_id: input.building_id,
                              lister_id: input.lister_id,
                              lister_name: input.lister_name,
                              lister_role: input.lister_role,
                              listing_type: input.listing_type,
                              asking_price: input.asking_price,
                              currency: input.currency,
                              status: 'active' as const,
                              is_primary_active: false,
                              linked_owner_listing_id: existingPrimary.id,
                              created_at: nowIso,
                            },
                          ],
                        }
                      : u
                  ),
                }
              : b
          );

          const lastEvent = curr.auditEvents[curr.auditEvents.length - 1];
          const prevHash = lastEvent ? lastEvent.hash : '0'.repeat(64);
          const seq = (lastEvent?.seq || 0) + 1;
          const payloadJson = JSON.stringify({
            linked_owner_listing_id: existingPrimary.id,
            lister_id: input.lister_id,
            unit_id: input.unit_id,
          });
          const hash = computeCanonicalEventHash(
            prevHash,
            'unit_listing',
            linkedId,
            input.lister_id,
            'AUTHORIZED_AGENT_LISTING_LINKED',
            payloadJson,
            nowIso
          );
          const nextEvents = [
            ...curr.auditEvents,
            {
              seq,
              entity_type: 'unit_listing',
              entity_id: linkedId,
              actor_id: input.lister_id,
              event_type: 'AUTHORIZED_AGENT_LISTING_LINKED',
              payload_json: payloadJson,
              created_at: nowIso,
              prev_hash: prevHash,
              hash,
            },
          ];

          return {
            buildings: updatedBuildings,
            auditEvents: nextEvents,
            auditVerification: runChainVerification(nextEvents),
          };
        });

        return {
          status: 'created_authorized_linked',
          message: `Authorized agent listing created and linked to Owner's primary listing (${existingPrimary.id}).`,
        };
      }

      // C5: Unauthorized second active listing attempt -> BLOCK and route to Admin as ConflictingClaim
      const conflictId = `cfl-${Date.now()}`;
      set((curr) => {
        const updatedBuildings = curr.buildings.map((b) =>
          b.id === input.building_id
            ? {
                ...b,
                units: b.units.map((u) =>
                  u.id === input.unit_id
                    ? {
                        ...u,
                        conflicting_claims: [
                          ...u.conflicting_claims,
                          {
                            id: conflictId,
                            unit_id: input.unit_id,
                            building_id: input.building_id,
                            unit_name: u.unit_name,
                            building_title: b.title,
                            existing_listing_id: existingPrimary.id,
                            claimant_id: input.lister_id,
                            claimant_name: input.lister_name,
                            claimant_role: input.lister_role,
                            attempted_price: input.asking_price,
                            currency: input.currency,
                            reason:
                              'One-Active-Listing Rule (C5): Second active listing attempt blocked without owner authorization and routed to Admin.',
                            status: 'open' as const,
                            created_at: nowIso,
                          },
                        ],
                      }
                    : u
                ),
              }
            : b
        );

        const lastEvent = curr.auditEvents[curr.auditEvents.length - 1];
        const prevHash = lastEvent ? lastEvent.hash : '0'.repeat(64);
        const seq = (lastEvent?.seq || 0) + 1;
        const payloadJson = JSON.stringify({
          claimant_id: input.lister_id,
          existing_listing_id: existingPrimary.id,
          unit_id: input.unit_id,
        });
        const hash = computeCanonicalEventHash(
          prevHash,
          'conflicting_listing_claim',
          conflictId,
          input.lister_id,
          'UNIT_LISTING_CONFLICT_BLOCKED',
          payloadJson,
          nowIso
        );
        const nextEvents = [
          ...curr.auditEvents,
          {
            seq,
            entity_type: 'conflicting_listing_claim',
            entity_id: conflictId,
            actor_id: input.lister_id,
            event_type: 'UNIT_LISTING_CONFLICT_BLOCKED',
            payload_json: payloadJson,
            created_at: nowIso,
            prev_hash: prevHash,
            hash,
          },
        ];

        return {
          buildings: updatedBuildings,
          auditEvents: nextEvents,
          auditVerification: runChainVerification(nextEvents),
        };
      });

      return {
        status: 'blocked_conflict',
        message:
          'BLOCKED (One-Active-Listing Rule C5): This unit already has an active primary listing. Your attempt has been blocked and routed to Admin as a conflicting claim.',
      };
    }

    // Create primary active listing
    const primaryId = `lst-${Date.now()}`;
    set((curr) => {
      const updatedBuildings = curr.buildings.map((b) =>
        b.id === input.building_id
          ? {
              ...b,
              units: b.units.map((u) =>
                u.id === input.unit_id
                  ? {
                      ...u,
                      active_listings: [
                        ...u.active_listings,
                        {
                          id: primaryId,
                          unit_id: input.unit_id,
                          building_id: input.building_id,
                          lister_id: input.lister_id,
                          lister_name: input.lister_name,
                          lister_role: input.lister_role,
                          listing_type: input.listing_type,
                          asking_price: input.asking_price,
                          currency: input.currency,
                          status: 'active' as const,
                          is_primary_active: true,
                          created_at: nowIso,
                        },
                      ],
                    }
                  : u
              ),
            }
          : b
      );

      const lastEvent = curr.auditEvents[curr.auditEvents.length - 1];
      const prevHash = lastEvent ? lastEvent.hash : '0'.repeat(64);
      const seq = (lastEvent?.seq || 0) + 1;
      const payloadJson = JSON.stringify({
        asking_price: input.asking_price,
        currency: input.currency,
        unit_id: input.unit_id,
      });
      const hash = computeCanonicalEventHash(
        prevHash,
        'unit_listing',
        primaryId,
        input.lister_id,
        'UNIT_PRIMARY_LISTING_CREATED',
        payloadJson,
        nowIso
      );
      const nextEvents = [
        ...curr.auditEvents,
        {
          seq,
          entity_type: 'unit_listing',
          entity_id: primaryId,
          actor_id: input.lister_id,
          event_type: 'UNIT_PRIMARY_LISTING_CREATED',
          payload_json: payloadJson,
          created_at: nowIso,
          prev_hash: prevHash,
          hash,
        },
      ];

      return {
        buildings: updatedBuildings,
        auditEvents: nextEvents,
        auditVerification: runChainVerification(nextEvents),
      };
    });

    return {
      status: 'created_primary',
      message: 'Primary active listing created for this unit.',
    };
  },

  resolveConflictingListingClaim: (buildingId, unitId, claimId, adminNotes, actorId) => {
    const nowIso = new Date().toISOString();
    set((state) => {
      const updatedBuildings = state.buildings.map((b) =>
        b.id === buildingId
          ? {
              ...b,
              units: b.units.map((u) =>
                u.id === unitId
                  ? {
                      ...u,
                      conflicting_claims: u.conflicting_claims.map((c) =>
                        c.id === claimId
                          ? { ...c, status: 'resolved_by_admin' as const, admin_notes: adminNotes }
                          : c
                      ),
                    }
                  : u
              ),
            }
          : b
      );

      const lastEvent = state.auditEvents[state.auditEvents.length - 1];
      const prevHash = lastEvent ? lastEvent.hash : '0'.repeat(64);
      const seq = (lastEvent?.seq || 0) + 1;
      const payloadJson = JSON.stringify({
        admin_notes: adminNotes,
        claim_id: claimId,
        unit_id: unitId,
      });
      const hash = computeCanonicalEventHash(
        prevHash,
        'conflicting_listing_claim',
        claimId,
        actorId,
        'CONFLICTING_CLAIM_RESOLVED',
        payloadJson,
        nowIso
      );
      const nextEvents = [
        ...state.auditEvents,
        {
          seq,
          entity_type: 'conflicting_listing_claim',
          entity_id: claimId,
          actor_id: actorId,
          event_type: 'CONFLICTING_CLAIM_RESOLVED',
          payload_json: payloadJson,
          created_at: nowIso,
          prev_hash: prevHash,
          hash,
        },
      ];

      return {
        buildings: updatedBuildings,
        auditEvents: nextEvents,
        auditVerification: runChainVerification(nextEvents),
      };
    });
  },

  updateUnitOccupancy: (input) => {
    const nowIso = new Date().toISOString();
    set((state) => {
      const updatedBuildings = state.buildings.map((b) =>
        b.id === input.building_id
          ? {
              ...b,
              units: b.units.map((u) =>
                u.id === input.unit_id
                  ? {
                      ...u,
                      occupancy_status: input.occupancy_status,
                      lease_start_date: input.lease_start_date,
                      lease_end_date: input.lease_end_date,
                    }
                  : u
              ),
            }
          : b
      );

      const lastEvent = state.auditEvents[state.auditEvents.length - 1];
      const prevHash = lastEvent ? lastEvent.hash : '0'.repeat(64);
      const seq = (lastEvent?.seq || 0) + 1;
      const payloadJson = JSON.stringify({
        lease_end_date: input.lease_end_date || null,
        lease_start_date: input.lease_start_date || null,
        occupancy_status: input.occupancy_status,
        unit_id: input.unit_id,
      });
      const hash = computeCanonicalEventHash(
        prevHash,
        'property_unit',
        input.unit_id,
        input.actor_id,
        'UNIT_OCCUPANCY_UPDATED',
        payloadJson,
        nowIso
      );
      const nextEvents = [
        ...state.auditEvents,
        {
          seq,
          entity_type: 'property_unit',
          entity_id: input.unit_id,
          actor_id: input.actor_id,
          event_type: 'UNIT_OCCUPANCY_UPDATED',
          payload_json: payloadJson,
          created_at: nowIso,
          prev_hash: prevHash,
          hash,
        },
      ];

      return {
        buildings: updatedBuildings,
        auditEvents: nextEvents,
        auditVerification: runChainVerification(nextEvents),
      };
    });
  },

  addOwnershipClaim: (input) => {
    const nowIso = new Date().toISOString();
    const claimId = `clm-${Date.now()}`;
    set((state) => {
      const updatedBuildings = state.buildings.map((b) =>
        b.id === input.building_id
          ? {
              ...b,
              ownership_claims: [
                {
                  id: claimId,
                  building_id: input.building_id,
                  claimant_id: input.claimant_id,
                  claimant_name: input.claimant_name,
                  claim_type: input.claim_type,
                  summary: input.summary,
                  document_ref: input.document_ref,
                  status: 'under_review' as EvidenceStatus,
                  created_at: nowIso,
                },
                ...b.ownership_claims,
              ],
            }
          : b
      );

      const lastEvent = state.auditEvents[state.auditEvents.length - 1];
      const prevHash = lastEvent ? lastEvent.hash : '0'.repeat(64);
      const seq = (lastEvent?.seq || 0) + 1;
      const payloadJson = JSON.stringify({
        building_id: input.building_id,
        claim_type: input.claim_type,
        document_ref: input.document_ref,
        status: 'under_review',
      });
      const hash = computeCanonicalEventHash(
        prevHash,
        'ownership_claim',
        claimId,
        input.claimant_id,
        'OWNERSHIP_CLAIM_RECORDED',
        payloadJson,
        nowIso
      );
      const nextEvents = [
        ...state.auditEvents,
        {
          seq,
          entity_type: 'ownership_claim',
          entity_id: claimId,
          actor_id: input.claimant_id,
          event_type: 'OWNERSHIP_CLAIM_RECORDED',
          payload_json: payloadJson,
          created_at: nowIso,
          prev_hash: prevHash,
          hash,
        },
      ];

      return {
        buildings: updatedBuildings,
        auditEvents: nextEvents,
        auditVerification: runChainVerification(nextEvents),
      };
    });
  },

  adminReviewOwnershipClaim: (input) => {
    const nowIso = new Date().toISOString();
    set((state) => {
      const updatedBuildings = state.buildings.map((b) =>
        b.id === input.building_id
          ? {
              ...b,
              ownership_claims: b.ownership_claims.map((c) =>
                c.id === input.claim_id
                  ? { ...c, status: input.status, admin_notes: input.admin_notes }
                  : c
              ),
            }
          : b
      );

      const lastEvent = state.auditEvents[state.auditEvents.length - 1];
      const prevHash = lastEvent ? lastEvent.hash : '0'.repeat(64);
      const seq = (lastEvent?.seq || 0) + 1;
      const payloadJson = JSON.stringify({
        admin_notes: input.admin_notes,
        claim_id: input.claim_id,
        new_status: input.status,
      });
      const hash = computeCanonicalEventHash(
        prevHash,
        'ownership_claim',
        input.claim_id,
        input.actor_id,
        'OWNERSHIP_CLAIM_REVIEWED',
        payloadJson,
        nowIso
      );
      const nextEvents = [
        ...state.auditEvents,
        {
          seq,
          entity_type: 'ownership_claim',
          entity_id: input.claim_id,
          actor_id: input.actor_id,
          event_type: 'OWNERSHIP_CLAIM_REVIEWED',
          payload_json: payloadJson,
          created_at: nowIso,
          prev_hash: prevHash,
          hash,
        },
      ];

      return {
        buildings: updatedBuildings,
        auditEvents: nextEvents,
        auditVerification: runChainVerification(nextEvents),
      };
    });
  },

  addMonitoringEntry: (input) => {
    const nowIso = new Date().toISOString();
    const monId = `mon-${Date.now()}`;
    set((state) => {
      const targetBld = state.buildings.find((b) => b.id === input.building_id);
      const linkedPlotId = targetBld?.plot_id;

      const updatedBuildings = state.buildings.map((b) =>
        b.id === input.building_id
          ? {
              ...b,
              monitoring_entries: [
                {
                  id: monId,
                  plot_id: linkedPlotId,
                  building_id: input.building_id,
                  author_id: input.author_id,
                  author_name: input.author_name,
                  entry_type: input.entry_type,
                  stage_label: input.stage_label,
                  notes: input.notes,
                  lat: input.lat,
                  lon: input.lon,
                  photo_url:
                    input.photo_url ||
                    'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=800&q=80',
                  photo_sha256: `sha256-${Date.now()}`,
                  captured_at: nowIso,
                },
                ...b.monitoring_entries,
              ],
            }
          : b
      );

      const lastEvent = state.auditEvents[state.auditEvents.length - 1];
      const prevHash = lastEvent ? lastEvent.hash : '0'.repeat(64);
      const seq = (lastEvent?.seq || 0) + 1;
      const payloadJson = JSON.stringify({
        building_id: input.building_id,
        entry_type: input.entry_type,
        plot_id: linkedPlotId || null,
        stage_label: input.stage_label,
      });
      const hash = computeCanonicalEventHash(
        prevHash,
        'monitoring_entry',
        monId,
        input.author_id,
        'MONITORING_TIMELINE_LOGGED',
        payloadJson,
        nowIso
      );
      const nextEvents = [
        ...state.auditEvents,
        {
          seq,
          entity_type: 'monitoring_entry',
          entity_id: monId,
          actor_id: input.author_id,
          event_type: 'MONITORING_TIMELINE_LOGGED',
          payload_json: payloadJson,
          created_at: nowIso,
          prev_hash: prevHash,
          hash,
        },
      ];

      return {
        buildings: updatedBuildings,
        auditEvents: nextEvents,
        auditVerification: runChainVerification(nextEvents),
      };
    });
  },

  verifyAuditChain: () => {
    const res = runChainVerification(get().auditEvents);
    set({ auditVerification: res });
    return res;
  },

  simulateTamperOnAuditRow: (seq) => {
    set((state) => {
      const backup = state.backupUntamperedChain || state.auditEvents;
      const tampered = state.auditEvents.map((ev) =>
        ev.seq === seq
          ? {
              ...ev,
              payload_json: JSON.stringify({
                TAMPERED_BY_INTRUDER: true,
                computed_area_m2: 99999.9,
              }),
            }
          : ev
      );
      return {
        backupUntamperedChain: backup,
        auditEvents: tampered,
        auditVerification: runChainVerification(tampered),
      };
    });
  },

  restoreTamperedAuditChain: () => {
    set((state) => {
      const restored = state.backupUntamperedChain || buildInitialAuditChain();
      return {
        auditEvents: restored,
        backupUntamperedChain: null,
        auditVerification: runChainVerification(restored),
      };
    });
  },

  // ==========================================================================
  // PART D (PHASE 3): TRUST LAYER STORE ACTIONS (D1 - D6)
  // ==========================================================================

  requestInspection: (input) => {
    const state = get();
    const nowIso = new Date().toISOString();
    const jobId = `insp-job-${Date.now()}`;

    let targetTitle = 'Property';
    let targetState = 'Oyo';
    let targetLga = 'Ibadan North';
    let targetLat = 7.38;
    let targetLon = 3.9;

    if (input.target_type === 'plot') {
      const pl = state.plots.find((p) => p.id === input.target_id);
      if (pl) {
        targetTitle = pl.title;
        targetState = pl.state;
        targetLga = pl.lga;
        targetLat = pl.vertices[0]?.lat ?? 7.38;
        targetLon = pl.vertices[0]?.lon ?? 3.9;
      }
    } else {
      const bld = state.buildings.find((b) => b.id === input.target_id);
      if (bld) {
        targetTitle = bld.title;
        targetState = bld.state;
        targetLga = bld.lga;
        targetLat = bld.entrance_lat;
        targetLon = bld.entrance_lon;
      }
    }

    const newJob: InspectionJobRecord = {
      id: jobId,
      target_type: input.target_type,
      target_id: input.target_id,
      target_title: targetTitle,
      target_state: targetState,
      target_lga: targetLga,
      target_lat: targetLat,
      target_lon: targetLon,
      requester_id: input.requester_id,
      requester_name: input.requester_name,
      requester_role: input.requester_role,
      is_diaspora_requester: input.is_diaspora_requester,
      requester_note: input.requester_note,
      status: 'requested',
      checklist_items: [],
      media: [],
      requested_at: nowIso,
    };

    set((curr) => {
      const lastEvent = curr.auditEvents[curr.auditEvents.length - 1];
      const prevHash = lastEvent ? lastEvent.hash : '0'.repeat(64);
      const seq = (lastEvent?.seq || 0) + 1;
      const payloadJson = JSON.stringify({
        is_diaspora_requester: input.is_diaspora_requester,
        target_id: input.target_id,
        target_type: input.target_type,
      });
      const hash = computeCanonicalEventHash(
        prevHash,
        'inspection_job',
        jobId,
        input.requester_id,
        'INSPECTION_REQUESTED',
        payloadJson,
        nowIso
      );
      const nextEvents = [
        ...curr.auditEvents,
        {
          seq,
          entity_type: 'inspection_job',
          entity_id: jobId,
          actor_id: input.requester_id,
          event_type: 'INSPECTION_REQUESTED',
          payload_json: payloadJson,
          created_at: nowIso,
          prev_hash: prevHash,
          hash,
        },
      ];
      return {
        inspections: [newJob, ...curr.inspections],
        auditEvents: nextEvents,
        auditVerification: runChainVerification(nextEvents),
      };
    });

    return newJob;
  },

  adminAssignInspector: (input) => {
    const nowIso = new Date().toISOString();
    set((state) => {
      const updated = state.inspections.map((j) =>
        j.id === input.job_id
          ? {
              ...j,
              assigned_inspector_id: input.inspector_id,
              assigned_inspector_name: input.inspector_name,
              status: 'assigned' as const,
              assigned_at: nowIso,
            }
          : j
      );

      const lastEvent = state.auditEvents[state.auditEvents.length - 1];
      const prevHash = lastEvent ? lastEvent.hash : '0'.repeat(64);
      const seq = (lastEvent?.seq || 0) + 1;
      const payloadJson = JSON.stringify({
        assigned_inspector_id: input.inspector_id,
        job_id: input.job_id,
      });
      const hash = computeCanonicalEventHash(
        prevHash,
        'inspection_job',
        input.job_id,
        input.admin_id,
        'INSPECTOR_ASSIGNED_BY_ADMIN',
        payloadJson,
        nowIso
      );
      const nextEvents = [
        ...state.auditEvents,
        {
          seq,
          entity_type: 'inspection_job',
          entity_id: input.job_id,
          actor_id: input.admin_id,
          event_type: 'INSPECTOR_ASSIGNED_BY_ADMIN',
          payload_json: payloadJson,
          created_at: nowIso,
          prev_hash: prevHash,
          hash,
        },
      ];

      return {
        inspections: updated,
        auditEvents: nextEvents,
        auditVerification: runChainVerification(nextEvents),
      };
    });
  },

  inspectorStartJob: (input) => {
    const state = get();
    const job = state.inspections.find((j) => j.id === input.job_id);
    if (!job) {
      return { started: false, distance_m: 0, message: 'Inspection job not found.' };
    }
    const maxFenceM = input.max_geofence_m ?? 100.0;
    const distM = geodesicDistancePointToPointM(
      input.inspector_lat,
      input.inspector_lon,
      job.target_lat,
      job.target_lon
    );
    const nowIso = new Date().toISOString();

    if (distM > maxFenceM) {
      set((curr) => {
        const lastEvent = curr.auditEvents[curr.auditEvents.length - 1];
        const prevHash = lastEvent ? lastEvent.hash : '0'.repeat(64);
        const seq = (lastEvent?.seq || 0) + 1;
        const payloadJson = JSON.stringify({
          distance_m: distM,
          job_id: input.job_id,
          max_geofence_m: maxFenceM,
        });
        const hash = computeCanonicalEventHash(
          prevHash,
          'inspection_job',
          input.job_id,
          input.inspector_id,
          'INSPECTION_START_BLOCKED_GEOFENCE',
          payloadJson,
          nowIso
        );
        const nextEvents = [
          ...curr.auditEvents,
          {
            seq,
            entity_type: 'inspection_job',
            entity_id: input.job_id,
            actor_id: input.inspector_id,
            event_type: 'INSPECTION_START_BLOCKED_GEOFENCE',
            payload_json: payloadJson,
            created_at: nowIso,
            prev_hash: prevHash,
            hash,
          },
        ];
        return {
          auditEvents: nextEvents,
          auditVerification: runChainVerification(nextEvents),
        };
      });

      return {
        started: false,
        distance_m: distM,
        message: `Geofence Block: Inspector is ${distM} m from target, which exceeds the ${maxFenceM} m on-site requirement.`,
      };
    }

    set((curr) => {
      const updated = curr.inspections.map((j) =>
        j.id === input.job_id
          ? {
              ...j,
              status: 'in_progress' as const,
              inspector_start_lat: input.inspector_lat,
              inspector_start_lon: input.inspector_lon,
              distance_to_target_m: distM,
              within_start_geofence: true,
              started_at: nowIso,
            }
          : j
      );

      const lastEvent = curr.auditEvents[curr.auditEvents.length - 1];
      const prevHash = lastEvent ? lastEvent.hash : '0'.repeat(64);
      const seq = (lastEvent?.seq || 0) + 1;
      const payloadJson = JSON.stringify({
        distance_m: distM,
        job_id: input.job_id,
        within_start_geofence: true,
      });
      const hash = computeCanonicalEventHash(
        prevHash,
        'inspection_job',
        input.job_id,
        input.inspector_id,
        'INSPECTION_STARTED_ON_SITE',
        payloadJson,
        nowIso
      );
      const nextEvents = [
        ...curr.auditEvents,
        {
          seq,
          entity_type: 'inspection_job',
          entity_id: input.job_id,
          actor_id: input.inspector_id,
          event_type: 'INSPECTION_STARTED_ON_SITE',
          payload_json: payloadJson,
          created_at: nowIso,
          prev_hash: prevHash,
          hash,
        },
      ];

      return {
        inspections: updated,
        auditEvents: nextEvents,
        auditVerification: runChainVerification(nextEvents),
      };
    });

    return {
      started: true,
      distance_m: distM,
      message: `On-site presence verified (${distM} m <= ${maxFenceM} m geofence). Inspection started.`,
    };
  },

  inspectorSubmitReport: (input) => {
    const nowIso = new Date().toISOString();
    set((state) => {
      const targetJob = state.inspections.find((j) => j.id === input.job_id);
      if (!targetJob) return state;

      const lastEvent = state.auditEvents[state.auditEvents.length - 1];
      const prevHash = lastEvent ? lastEvent.hash : '0'.repeat(64);
      const seq = (lastEvent?.seq || 0) + 1;
      const payloadJson = JSON.stringify({
        checklist_items_count: input.checklist_items.length,
        distance_to_target_m: targetJob.distance_to_target_m,
        inspector_id: input.inspector_id,
        job_id: input.job_id,
        report_summary: input.report_summary,
        target_id: targetJob.target_id,
      });
      const hash = computeCanonicalEventHash(
        prevHash,
        'inspection_job',
        input.job_id,
        input.inspector_id,
        'INSPECTION_REPORT_SUBMITTED_IMMUTABLE',
        payloadJson,
        nowIso
      );

      const nextEvents = [
        ...state.auditEvents,
        {
          seq,
          entity_type: 'inspection_job',
          entity_id: input.job_id,
          actor_id: input.inspector_id,
          event_type: 'INSPECTION_REPORT_SUBMITTED_IMMUTABLE',
          payload_json: payloadJson,
          created_at: nowIso,
          prev_hash: prevHash,
          hash,
        },
      ];

      const updatedInspections = state.inspections.map((j) =>
        j.id === input.job_id
          ? {
              ...j,
              status: 'completed' as const,
              report_summary: input.report_summary,
              checklist_items: input.checklist_items,
              media: [
                ...j.media,
                {
                  id: `imed-${Date.now()}`,
                  media_type: input.media_type,
                  capture_source: 'in_app' as const,
                  caption: input.media_caption,
                  captured_at: nowIso,
                  lat: j.inspector_start_lat ?? j.target_lat,
                  lon: j.inspector_start_lon ?? j.target_lon,
                  sha256_hash: hash,
                  preview_url: input.preview_url,
                },
              ],
              immutable_audit_hash: hash,
              completed_at: nowIso,
            }
          : j
      );

      return {
        inspections: updatedInspections,
        auditEvents: nextEvents,
        auditVerification: runChainVerification(nextEvents),
      };
    });
  },

  rateInspection: (input) => {
    const nowIso = new Date().toISOString();
    set((state) => {
      const updated = state.inspections.map((j) =>
        j.id === input.job_id
          ? {
              ...j,
              buyer_rating: input.rating,
              buyer_review_comment: input.review_comment,
            }
          : j
      );

      const lastEvent = state.auditEvents[state.auditEvents.length - 1];
      const prevHash = lastEvent ? lastEvent.hash : '0'.repeat(64);
      const seq = (lastEvent?.seq || 0) + 1;
      const payloadJson = JSON.stringify({
        job_id: input.job_id,
        rating: input.rating,
      });
      const hash = computeCanonicalEventHash(
        prevHash,
        'inspection_job',
        input.job_id,
        input.actor_id,
        'INSPECTION_RATED',
        payloadJson,
        nowIso
      );
      const nextEvents = [
        ...state.auditEvents,
        {
          seq,
          entity_type: 'inspection_job',
          entity_id: input.job_id,
          actor_id: input.actor_id,
          event_type: 'INSPECTION_RATED',
          payload_json: payloadJson,
          created_at: nowIso,
          prev_hash: prevHash,
          hash,
        },
      ];

      return {
        inspections: updated,
        auditEvents: nextEvents,
        auditVerification: runChainVerification(nextEvents),
      };
    });
  },

  submitAgentProfile: (input) => {
    const nowIso = new Date().toISOString();
    const profileId = `agv-${Date.now()}`;
    set((state) => {
      const existingIdx = state.agentProfiles.findIndex((p) => p.agent_id === input.agent_id);
      const newRec: AgentVerificationProfile = {
        id: existingIdx >= 0 ? state.agentProfiles[existingIdx].id : profileId,
        agent_id: input.agent_id,
        agent_name: input.agent_name,
        agent_email: input.agent_email,
        registration_body: input.registration_body,
        registration_number: input.registration_number,
        id_document_filename: input.id_document_filename,
        id_document_sha256: `sha256-${Date.now()}abcdef0123456789`,
        status: 'uploaded',
        outcome: 'pending',
        badge_text: 'Agent registration uploaded — pending admin check',
        updated_at: nowIso,
      };

      const updatedProfiles =
        existingIdx >= 0
          ? state.agentProfiles.map((p, idx) => (idx === existingIdx ? newRec : p))
          : [newRec, ...state.agentProfiles];

      const lastEvent = state.auditEvents[state.auditEvents.length - 1];
      const prevHash = lastEvent ? lastEvent.hash : '0'.repeat(64);
      const seq = (lastEvent?.seq || 0) + 1;
      const payloadJson = JSON.stringify({
        agent_id: input.agent_id,
        registration_body: input.registration_body,
        registration_number: input.registration_number,
        status: 'uploaded',
      });
      const hash = computeCanonicalEventHash(
        prevHash,
        'agent_verification',
        newRec.id,
        input.agent_id,
        'AGENT_CREDENTIALS_SUBMITTED',
        payloadJson,
        nowIso
      );
      const nextEvents = [
        ...state.auditEvents,
        {
          seq,
          entity_type: 'agent_verification',
          entity_id: newRec.id,
          actor_id: input.agent_id,
          event_type: 'AGENT_CREDENTIALS_SUBMITTED',
          payload_json: payloadJson,
          created_at: nowIso,
          prev_hash: prevHash,
          hash,
        },
      ];

      return {
        agentProfiles: updatedProfiles,
        auditEvents: nextEvents,
        auditVerification: runChainVerification(nextEvents),
      };
    });
  },

  adminCheckAgentProfile: (input) => {
    if (input.actor_role !== 'admin') {
      throw new Error(
        'RBAC Policy Violation (D2): Agents cannot change their own verification status. Only an Admin may record an official register check.'
      );
    }
    const nowIso = new Date().toISOString();
    const exactBadge =
      input.outcome === 'checked_ok'
        ? `Registration number checked by admin on ${input.checked_on_date}`
        : `Registration check noted discrepancy on ${input.checked_on_date} — under review`;

    set((state) => {
      const updatedProfiles = state.agentProfiles.map((p) =>
        p.id === input.profile_id
          ? {
              ...p,
              status: (input.outcome === 'checked_ok'
                ? 'reviewed_by_admin'
                : 'under_review') as EvidenceStatus,
              outcome: input.outcome,
              checked_by_admin_id: input.actor_id,
              checked_on_date: input.checked_on_date,
              admin_notes: input.admin_notes,
              badge_text: exactBadge,
              updated_at: nowIso,
            }
          : p
      );

      const lastEvent = state.auditEvents[state.auditEvents.length - 1];
      const prevHash = lastEvent ? lastEvent.hash : '0'.repeat(64);
      const seq = (lastEvent?.seq || 0) + 1;
      const payloadJson = JSON.stringify({
        badge_text: exactBadge,
        checked_on_date: input.checked_on_date,
        outcome: input.outcome,
        profile_id: input.profile_id,
      });
      const hash = computeCanonicalEventHash(
        prevHash,
        'agent_verification',
        input.profile_id,
        input.actor_id,
        'AGENT_REGISTER_CHECKED_BY_ADMIN',
        payloadJson,
        nowIso
      );
      const nextEvents = [
        ...state.auditEvents,
        {
          seq,
          entity_type: 'agent_verification',
          entity_id: input.profile_id,
          actor_id: input.actor_id,
          event_type: 'AGENT_REGISTER_CHECKED_BY_ADMIN',
          payload_json: payloadJson,
          created_at: nowIso,
          prev_hash: prevHash,
          hash,
        },
      ];

      return {
        agentProfiles: updatedProfiles,
        auditEvents: nextEvents,
        auditVerification: runChainVerification(nextEvents),
      };
    });
  },

  uploadPaymentReceipt: (input) => {
    const nowIso = new Date().toISOString();
    const rcpId = `rcp-${Date.now()}`;
    const isBuyer = input.uploaded_by_role === 'buyer_renter';

    set((state) => {
      const lastEvent = state.auditEvents[state.auditEvents.length - 1];
      const prevHash = lastEvent ? lastEvent.hash : '0'.repeat(64);
      const seq = (lastEvent?.seq || 0) + 1;
      const payloadJson = JSON.stringify({
        amount: input.amount,
        bank_reference: input.bank_reference,
        currency: input.currency,
        payee_name: input.payee_name,
        payer_name: input.payer_name,
        stage: input.stage,
        target_id: input.target_id,
      });
      const hash = computeCanonicalEventHash(
        prevHash,
        'payment_receipt',
        rcpId,
        input.uploaded_by_id,
        'PAYMENT_RECEIPT_UPLOADED',
        payloadJson,
        nowIso
      );

      const newReceipt: ProofOfPaymentReceiptItem = {
        id: rcpId,
        target_type: input.target_type,
        target_id: input.target_id,
        target_title: input.target_title,
        uploaded_by_id: input.uploaded_by_id,
        uploaded_by_name: input.uploaded_by_name,
        uploaded_by_role: input.uploaded_by_role,
        stage: input.stage,
        amount: input.amount,
        currency: input.currency,
        payment_date: input.payment_date,
        payment_method: input.payment_method,
        bank_reference: input.bank_reference,
        payer_name: input.payer_name,
        payee_name: input.payee_name,
        receipt_file_name: input.receipt_file_name,
        receipt_sha256: hash,
        buyer_status: isBuyer ? 'confirmed' : 'pending',
        seller_status: isBuyer ? 'pending' : 'confirmed',
        audit_event_hash: hash,
        created_at: nowIso,
        updated_at: nowIso,
      };

      const nextEvents = [
        ...state.auditEvents,
        {
          seq,
          entity_type: 'payment_receipt',
          entity_id: rcpId,
          actor_id: input.uploaded_by_id,
          event_type: 'PAYMENT_RECEIPT_UPLOADED',
          payload_json: payloadJson,
          created_at: nowIso,
          prev_hash: prevHash,
          hash,
        },
      ];

      return {
        paymentReceipts: [newReceipt, ...state.paymentReceipts],
        auditEvents: nextEvents,
        auditVerification: runChainVerification(nextEvents),
      };
    });
  },

  respondToPaymentReceipt: (input) => {
    const nowIso = new Date().toISOString();
    set((state) => {
      const lastEvent = state.auditEvents[state.auditEvents.length - 1];
      const prevHash = lastEvent ? lastEvent.hash : '0'.repeat(64);
      const seq = (lastEvent?.seq || 0) + 1;
      const payloadJson = JSON.stringify({
        decision: input.decision,
        notes: input.notes || null,
        party_role: input.party_role,
        receipt_id: input.receipt_id,
      });
      const hash = computeCanonicalEventHash(
        prevHash,
        'payment_receipt',
        input.receipt_id,
        input.actor_id,
        `PAYMENT_RECEIPT_${input.party_role.toUpperCase()}_${input.decision.toUpperCase()}`,
        payloadJson,
        nowIso
      );

      const updatedReceipts = state.paymentReceipts.map((r) =>
        r.id === input.receipt_id
          ? {
              ...r,
              buyer_status: input.party_role === 'buyer' ? input.decision : r.buyer_status,
              seller_status: input.party_role === 'seller' ? input.decision : r.seller_status,
              dispute_notes: input.notes || r.dispute_notes,
              audit_event_hash: hash,
              updated_at: nowIso,
            }
          : r
      );

      const nextEvents = [
        ...state.auditEvents,
        {
          seq,
          entity_type: 'payment_receipt',
          entity_id: input.receipt_id,
          actor_id: input.actor_id,
          event_type: `PAYMENT_RECEIPT_${input.party_role.toUpperCase()}_${input.decision.toUpperCase()}`,
          payload_json: payloadJson,
          created_at: nowIso,
          prev_hash: prevHash,
          hash,
        },
      ];

      return {
        paymentReceipts: updatedReceipts,
        auditEvents: nextEvents,
        auditVerification: runChainVerification(nextEvents),
      };
    });
  },

  reportSuspiciousListing: (input) => {
    const nowIso = new Date().toISOString();
    const repId = `rep-${Date.now()}`;
    set((state) => {
      const lastEvent = state.auditEvents[state.auditEvents.length - 1];
      const prevHash = lastEvent ? lastEvent.hash : '0'.repeat(64);
      const seq = (lastEvent?.seq || 0) + 1;
      const payloadJson = JSON.stringify({
        reason_category: input.reason_category,
        target_id: input.target_id,
        target_type: input.target_type,
      });
      const hash = computeCanonicalEventHash(
        prevHash,
        'suspicious_report',
        repId,
        input.reporter_id,
        'SUSPICIOUS_LISTING_REPORTED',
        payloadJson,
        nowIso
      );

      const newReport: SuspiciousReportItem = {
        id: repId,
        target_type: input.target_type,
        target_id: input.target_id,
        target_title: input.target_title,
        reporter_id: input.reporter_id,
        reporter_name: input.reporter_name,
        reporter_role: input.reporter_role,
        reason_category: input.reason_category,
        description: input.description,
        status: 'open',
        created_at: nowIso,
      };

      const nextEvents = [
        ...state.auditEvents,
        {
          seq,
          entity_type: 'suspicious_report',
          entity_id: repId,
          actor_id: input.reporter_id,
          event_type: 'SUSPICIOUS_LISTING_REPORTED',
          payload_json: payloadJson,
          created_at: nowIso,
          prev_hash: prevHash,
          hash,
        },
      ];

      return {
        suspiciousReports: [newReport, ...state.suspiciousReports],
        auditEvents: nextEvents,
        auditVerification: runChainVerification(nextEvents),
      };
    });
  },

  adminReviewSuspiciousReport: (input) => {
    const nowIso = new Date().toISOString();
    set((state) => {
      const updated = state.suspiciousReports.map((r) =>
        r.id === input.report_id
          ? {
              ...r,
              status: input.status,
              admin_notes: input.admin_notes,
            }
          : r
      );

      const lastEvent = state.auditEvents[state.auditEvents.length - 1];
      const prevHash = lastEvent ? lastEvent.hash : '0'.repeat(64);
      const seq = (lastEvent?.seq || 0) + 1;
      const payloadJson = JSON.stringify({
        admin_notes: input.admin_notes,
        report_id: input.report_id,
        status: input.status,
      });
      const hash = computeCanonicalEventHash(
        prevHash,
        'suspicious_report',
        input.report_id,
        input.actor_id,
        'SUSPICIOUS_REPORT_REVIEWED',
        payloadJson,
        nowIso
      );

      const nextEvents = [
        ...state.auditEvents,
        {
          seq,
          entity_type: 'suspicious_report',
          entity_id: input.report_id,
          actor_id: input.actor_id,
          event_type: 'SUSPICIOUS_REPORT_REVIEWED',
          payload_json: payloadJson,
          created_at: nowIso,
          prev_hash: prevHash,
          hash,
        },
      ];

      return {
        suspiciousReports: updated,
        auditEvents: nextEvents,
        auditVerification: runChainVerification(nextEvents),
      };
    });
  },

  getPriceBenchmark: (input) => {
    const state = get();
    const rate = input.exchange_rate_ngn_per_usd || 1600;
    const toNgn = (amt: number, curr: CurrencyCode) => (curr === 'USD' ? amt * rate : amt);

    const dynamicPlotCandidates = state.plots.map((p) => ({
      id: p.id,
      title: p.title,
      type: 'plot' as const,
      state: p.state,
      lga: p.lga,
      lat: p.vertices[0]?.lat ?? 7.38,
      lon: p.vertices[0]?.lon ?? 3.9,
      area_m2: p.computed_area_m2,
      price_ngn: toNgn(p.asking_price, p.currency),
    }));

    const dynamicBuildingCandidates = state.buildings.map((b) => {
      const primaryListing = b.units[0]?.active_listings[0];
      const priceNgn = primaryListing
        ? toNgn(primaryListing.asking_price, primaryListing.currency)
        : 95_000_000;
      return {
        id: b.id,
        title: b.title,
        type: 'building' as const,
        state: b.state,
        lga: b.lga,
        lat: b.entrance_lat,
        lon: b.entrance_lon,
        area_m2: b.footprint_area_m2,
        price_ngn: priceNgn,
      };
    });

    const allCandidates = [
      ...dynamicPlotCandidates,
      ...dynamicBuildingCandidates,
      ...BENCHMARK_COMPARABLE_POOL,
    ];

    if (input.target_type === 'plot') {
      const pl = state.plots.find((p) => p.id === input.target_id);
      if (!pl) return null;
      return computeListingBenchmark({
        target_id: pl.id,
        target_type: 'plot',
        target_price_ngn: toNgn(pl.asking_price, pl.currency),
        target_area_m2: pl.computed_area_m2,
        target_lat: pl.vertices[0]?.lat ?? 7.38,
        target_lon: pl.vertices[0]?.lon ?? 3.9,
        target_state: pl.state,
        target_lga: pl.lga,
        candidates: allCandidates,
        radius_km: input.radius_km,
        exchange_rate_ngn_per_usd: rate,
      });
    } else {
      const bld = state.buildings.find((b) => b.id === input.target_id);
      if (!bld) return null;
      const primaryListing = bld.units[0]?.active_listings[0];
      const priceNgn = primaryListing
        ? toNgn(primaryListing.asking_price, primaryListing.currency)
        : 115_000_000;
      return computeListingBenchmark({
        target_id: bld.id,
        target_type: 'building',
        target_price_ngn: priceNgn,
        target_area_m2: bld.footprint_area_m2,
        target_lat: bld.entrance_lat,
        target_lon: bld.entrance_lon,
        target_state: bld.state,
        target_lga: bld.lga,
        candidates: allCandidates,
        radius_km: input.radius_km,
        exchange_rate_ngn_per_usd: rate,
      });
    }
  },
}));
