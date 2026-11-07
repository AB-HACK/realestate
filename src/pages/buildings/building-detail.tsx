import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDataStore } from '../../stores/data-store';
import { useAuthStore } from '../../stores/auth-store';
import { useCurrencyStore } from '../../stores/currency-store';
import { InteractivePlotMap } from '../../components/evidence/interactive-plot-map';
import { InAppCamera } from '../../components/evidence/in-app-camera';
import { PriceBenchmarkCard } from '../../components/evidence/price-benchmark-card';
import {
  BUILT_PROPERTY_TYPE_LABELS,
  MANDATORY_CONDITION_CATEGORIES,
  MEASUREMENT_DISCLAIMER,
  EVIDENCE_STATUS_CONFIG,
} from '../../lib/nigeria-data';
import { fuzzOccupiedLocation } from '../../lib/geodesic';
import {
  ConditionCategory,
  ConditionItem,
  ConditionRating,
  EvidenceStatus,
  OccupancyStatus,
} from '../../types';
import {
  ArrowLeft,
  Building2,
  MapPin,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Droplets,
  ClipboardCheck,
  Camera,
  UserCheck,
  CalendarClock,
  History,
  Lock,
} from 'lucide-react';

export const BuildingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const {
    buildings,
    plots,
    addConditionChecklist,
    addBuildingPhoto,
    authorizeAgentForUnit,
    createUnitListing,
    updateUnitOccupancy,
    addOwnershipClaim,
    adminReviewOwnershipClaim,
    addMonitoringEntry,
  } = useDataStore();
  const { user, demoUsers } = useAuthStore();
  const { formatPrice } = useCurrencyStore();

  const bld = buildings.find((b) => b.id === id);

  // C3 New Condition Checklist Form State
  const [showChecklistForm, setShowChecklistForm] = useState(false);
  const [checklistRatings, setChecklistRatings] = useState<
    Record<ConditionCategory, { rating: ConditionRating; notes: string }>
  >(() => {
    const init = {} as Record<ConditionCategory, { rating: ConditionRating; notes: string }>;
    for (const cat of MANDATORY_CONDITION_CATEGORIES) {
      init[cat.id] = { rating: 'good', notes: 'Checked on site' };
    }
    return init;
  });

  // C4 Photo Room Selector
  const [selectedRoomForPhoto, setSelectedRoomForPhoto] = useState<string>('');

  // C5 Listing & Occupancy State
  const [listingActionResult, setListingActionResult] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [newListingPrice, setNewListingPrice] = useState<string>('9000000');

  // C6 Ownership Claim State
  const [claimType, setClaimType] = useState<
    'initial_claim' | 'transfer_of_interest' | 'lease_status_update' | 'encumbrance_note'
  >('transfer_of_interest');
  const [claimSummary, setClaimSummary] = useState('');
  const [claimDocRef, setClaimDocRef] = useState('');

  // C7 Monitoring Timeline State
  const [monType, setMonType] = useState<
    'construction_milestone' | 'maintenance_log' | 'reinspection_check'
  >('construction_milestone');
  const [monStageLabel, setMonStageLabel] = useState('');
  const [monNotes, setMonNotes] = useState('');

  if (!bld) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-base font-semibold text-slate-800">Building record not found.</p>
        <Link to="/buildings" className="text-sm text-emerald-700 underline">
          Return to Built Houses &amp; Apartments Registry
        </Link>
      </div>
    );
  }

  const linkedPlot = plots.find((p) => p.id === bld.plot_id);
  const isAdmin = user?.role === 'admin';
  const showFuzzed =
    bld.is_occupied_home &&
    !isAdmin &&
    user?.id !== bld.owner_id &&
    user?.role !== 'inspector';

  const fuzzedCoords = showFuzzed
    ? fuzzOccupiedLocation(bld.entrance_lat, bld.entrance_lon, bld.id, 300)
    : null;

  const handleCreateChecklist = (e: React.FormEvent) => {
    e.preventDefault();
    const items: ConditionItem[] = MANDATORY_CONDITION_CATEGORIES.map((c) => ({
      category: c.id,
      rating: checklistRatings[c.id].rating,
      notes: checklistRatings[c.id].notes,
    }));
    addConditionChecklist({
      building_id: bld.id,
      unit_id: bld.units[0]?.id,
      author_id: user?.id || 'usr-owner-1',
      author_name: user?.name || 'Chief Tunde Bakare',
      author_role: user?.role || 'owner',
      items,
    });
    setShowChecklistForm(false);
  };

  const handleAttemptUnitListing = (
    unitId: string,
    asListerId: string,
    asListerName: string,
    asListerRole: 'owner' | 'agent'
  ) => {
    const res = createUnitListing({
      building_id: bld.id,
      unit_id: unitId,
      lister_id: asListerId,
      lister_name: asListerName,
      lister_role: asListerRole,
      listing_type: 'rent',
      asking_price: Number(newListingPrice) || 8500000,
      currency: 'NGN',
    });
    setListingActionResult({
      type: res.status === 'blocked_conflict' ? 'error' : 'success',
      text: res.message,
    });
  };

  const handleAddOwnershipClaim = (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimSummary.trim() || !claimDocRef.trim()) return;
    addOwnershipClaim({
      building_id: bld.id,
      claimant_id: user?.id || bld.owner_id,
      claimant_name: user?.name || bld.owner_name,
      claim_type: claimType,
      summary: claimSummary.trim(),
      document_ref: claimDocRef.trim(),
    });
    setClaimSummary('');
    setClaimDocRef('');
  };

  const handleAddMonitoring = (e: React.FormEvent) => {
    e.preventDefault();
    if (!monStageLabel.trim() || !monNotes.trim()) return;
    addMonitoringEntry({
      building_id: bld.id,
      author_id: user?.id || bld.owner_id,
      author_name: user?.name || bld.owner_name,
      entry_type: monType,
      stage_label: monStageLabel.trim(),
      notes: monNotes.trim(),
      lat: bld.entrance_lat,
      lon: bld.entrance_lon,
    });
    setMonStageLabel('');
    setMonNotes('');
  };

  const agentDemo = demoUsers.find((u) => u.role === 'agent') || demoUsers[2];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/buildings"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Built Houses &amp; Apartments Registry
        </Link>
        <span className="text-xs text-slate-400 font-mono">Building ID: {bld.id}</span>
      </div>

      {/* Mandatory Disclaimer */}
      <div className="rounded-xl bg-amber-50 border border-amber-300 px-4 py-3 flex items-center gap-2.5 text-xs text-amber-950 font-semibold">
        <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0" />
        <span>{MEASUREMENT_DISCLAIMER}</span>
      </div>

      {/* Hero Summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-slate-900 text-white text-xs font-semibold">
                {BUILT_PROPERTY_TYPE_LABELS[bld.property_type] || bld.property_type} ·{' '}
                {bld.storeys} Storey(s)
              </span>
              {bld.year_built && (
                <span className="text-xs text-slate-500">Built {bld.year_built}</span>
              )}
              {bld.is_occupied_home && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 text-xs font-semibold">
                  <Lock className="h-3 w-3" />
                  NDPA ~300m Public Fuzzing Active
                </span>
              )}
            </div>

            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="h-6 w-6 text-emerald-700" />
              {bld.title}
            </h1>
            <p className="text-xs text-slate-600 flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-emerald-600" />
              {bld.address} ({bld.lga}, {bld.state})
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-1">
            <span className="text-slate-500 block">Footprint Geodesic Area</span>
            <span className="text-lg font-extrabold text-slate-900 block">
              {bld.footprint_area_m2} m² (Range: {bld.footprint_area_low_m2} –{' '}
              {bld.footprint_area_high_m2} m²)
            </span>
            {linkedPlot && (
              <Link
                to={`/plots/${linkedPlot.id}`}
                className="text-emerald-700 hover:underline font-semibold block"
              >
                Linked Parent Plot: {linkedPlot.title}
              </Link>
            )}
          </div>
        </div>

        {/* C1 Footprint Inside Linked Plot Status */}
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            bld.footprint_inside_plot
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : 'bg-rose-50 border-rose-300 text-rose-950'
          }`}
        >
          <span className="font-semibold flex items-center gap-2">
            {bld.footprint_inside_plot ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-700" />
            )}
            {bld.footprint_inside_plot
              ? 'C1 Containment Check Passed: Building footprint polygon falls strictly inside the linked plot boundary.'
              : `C1 Containment Flagged: Building footprint protrudes outside linked plot boundary (${bld.footprint_outside_pct}% outside)!`}
          </span>
          <span>Entrance GPS: {bld.entrance_lat.toFixed(5)}°N, {bld.entrance_lon.toFixed(5)}°E</span>
        </div>
      </div>

      {/* Interactive Map: Building Footprint vs Linked Plot */}
      <InteractivePlotMap
        vertices={bld.footprint_vertices}
        comparisonVertices={linkedPlot?.vertices}
        comparisonTitle={linkedPlot ? `Parent Plot (${linkedPlot.title})` : undefined}
        fuzzedCenter={
          fuzzedCoords
            ? {
                lat: fuzzedCoords.fuzzed_lat,
                lon: fuzzedCoords.fuzzed_lon,
                radiusM: fuzzedCoords.radius_m,
              }
            : null
        }
        photoPoints={bld.photos.map((ph) => ({
          id: ph.id,
          lat: ph.lat,
          lon: ph.lon,
          withinGeofence: ph.within_geofence,
        }))}
        heightClass="h-80"
      />

      {/* D3 & D6: Price Benchmarking (P5-P95 Band) & Suspicious Listing Report */}
      <PriceBenchmarkCard
        targetType="building"
        targetId={bld.id}
        targetTitle={bld.title}
      />

      {/* C1, C2 & C5: Units, Room Dimensions & One-Active-Listing Rule Console */}
      <div className="space-y-5">
        {bld.units.map((unit) => (
          <div
            key={unit.id}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Unit: {unit.unit_name} (Floor {unit.floor_number})
                </h2>
                <p className="text-xs text-slate-500">
                  {unit.bedrooms} Bedrooms · {unit.bathrooms} Bathrooms · Occupancy:{' '}
                  <strong className="uppercase text-emerald-800">
                    {unit.occupancy_status.replace('_', ' ')}
                  </strong>
                  {unit.lease_start_date &&
                    ` (Lease: ${unit.lease_start_date} to ${unit.lease_end_date})`}
                </p>
              </div>

              {/* Rental Occupancy Status Selector (C5: prevents multiple tenants paying for same unit) */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Update Occupancy:</span>
                <select
                  value={unit.occupancy_status}
                  onChange={(e) =>
                    updateUnitOccupancy({
                      building_id: bld.id,
                      unit_id: unit.id,
                      occupancy_status: e.target.value as OccupancyStatus,
                      lease_start_date:
                        e.target.value === 'tenant_occupied' ? '2026-03-01' : undefined,
                      lease_end_date:
                        e.target.value === 'tenant_occupied' ? '2027-02-28' : undefined,
                      actor_id: user?.id || bld.owner_id,
                    })
                  }
                  className="rounded-lg border border-slate-300 px-2.5 py-1.5 bg-slate-50 font-semibold"
                >
                  <option value="vacant">Vacant</option>
                  <option value="tenant_occupied">Tenant Occupied (Record Lease)</option>
                  <option value="owner_occupied">Owner Occupied</option>
                  <option value="under_renovation">Under Renovation</option>
                </select>
              </div>
            </div>

            {/* Nigerian Utility & Security Metadata (C1) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-400 block">Power &amp; DisCo</span>
                <span className="font-bold text-slate-900 flex items-center gap-1 mt-0.5">
                  <Zap className="h-3.5 w-3.5 text-amber-600" />
                  {unit.power_meter_type.toUpperCase()} · {unit.power_disco}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-400 block">Water Source</span>
                <span className="font-bold text-slate-900 flex items-center gap-1 mt-0.5">
                  <Droplets className="h-3.5 w-3.5 text-sky-600" />
                  {unit.water_source}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-400 block">Drainage &amp; Flood Notes</span>
                <span className="text-slate-800 mt-0.5 block">{unit.drainage_flood_notes}</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-400 block">Security Features</span>
                <span className="text-slate-800 mt-0.5 block">{unit.security_features}</span>
              </div>
            </div>

            {/* C2: Room Dimensions Table & 20% Discrepancy Check */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  C2. Measured Room Dimensions (Sum: {unit.computed_room_area_sum_m2} m² vs
                  Declared: {unit.declared_area_m2 || 'N/A'} m²)
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    unit.room_area_discrepancy_flagged
                      ? 'bg-rose-100 text-rose-900 border border-rose-300'
                      : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  }`}
                >
                  {unit.room_area_discrepancy_flagged
                    ? `⚠️ Flagged: ${unit.room_area_diff_pct}% Difference (>20% Threshold)`
                    : `✓ ${unit.room_area_diff_pct}% Difference (≤20% Threshold)`}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                      <th className="py-2 px-3">Room Name</th>
                      <th className="py-2 px-3">Length × Width × Height</th>
                      <th className="py-2 px-3">Computed Area</th>
                      <th className="py-2 px-3">Measurement Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {unit.rooms.map((rm) => (
                      <tr key={rm.id}>
                        <td className="py-2 px-3 font-semibold text-slate-900">{rm.room_name}</td>
                        <td className="py-2 px-3 font-mono">
                          {rm.length_m}m × {rm.width_m}m × {rm.height_m}m
                        </td>
                        <td className="py-2 px-3 font-bold text-emerald-800">
                          {rm.computed_area_m2} m²
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              rm.measurement_source === 'webxr_experimental'
                                ? 'bg-indigo-100 text-indigo-900'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {rm.measurement_source === 'webxr_experimental'
                              ? 'WebXR Hit-Test (Experimental)'
                              : 'Manual Tape / Laser'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* C5: One-Active-Listing Rule & Explicit Agent Authorization Console */}
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <UserCheck className="h-4 w-4 text-emerald-700" />
                    C5. One-Active-Listing Rule &amp; Agent Authorization Console
                  </h3>
                  <p className="text-xs text-slate-600">
                    A unit can have only one active primary listing. A second unauthorized attempt
                    is blocked and routed to Admin as a conflicting claim. Owners can explicitly
                    authorize agents to link a co-listing.
                  </p>
                </div>
              </div>

              {listingActionResult && (
                <div
                  className={`p-3 rounded-lg border text-xs font-semibold ${
                    listingActionResult.type === 'error'
                      ? 'bg-rose-50 border-rose-300 text-rose-900'
                      : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  }`}
                >
                  {listingActionResult.text}
                </div>
              )}

              {/* Active Listings List */}
              <div className="space-y-2">
                {unit.active_listings.map((lst) => (
                  <div
                    key={lst.id}
                    className="p-3 rounded-lg bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900">
                        {lst.is_primary_active
                          ? 'Primary Active Unit Listing'
                          : `Authorized Agent Co-Listing (Linked to ${lst.linked_owner_listing_id})`}
                      </span>
                      <span className="block text-slate-500">
                        Listed by <strong>{lst.lister_name}</strong> ({lst.lister_role}) · ID:{' '}
                        <code>{lst.id}</code>
                      </span>
                    </div>
                    <span className="text-sm font-extrabold text-emerald-700">
                      {formatPrice(lst.asking_price, lst.currency)} ({lst.listing_type})
                    </span>
                  </div>
                ))}
              </div>

              {/* Blocked Conflicting Claims */}
              {unit.conflicting_claims.length > 0 && (
                <div className="space-y-1.5">
                  {unit.conflicting_claims.map((c) => (
                    <div
                      key={c.id}
                      className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900"
                    >
                      <strong>Blocked Conflicting Listing Claim ({c.status}):</strong> {c.reason}
                    </div>
                  ))}
                </div>
              )}

              {/* Interactive C5 Test Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
                <input
                  type="number"
                  value={newListingPrice}
                  onChange={(e) => setNewListingPrice(e.target.value)}
                  className="w-36 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  placeholder="Price (NGN)"
                />
                <button
                  type="button"
                  onClick={() =>
                    handleAttemptUnitListing(
                      unit.id,
                      'usr-unauth-agent-99',
                      'Unregistered Agent Musa',
                      'agent'
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold"
                >
                  Test Unauthorized 2nd Listing (Will Block &amp; Route to Admin)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    authorizeAgentForUnit({
                      building_id: bld.id,
                      unit_id: unit.id,
                      owner_id: bld.owner_id,
                      agent_id: agentDemo.id,
                      agent_name: agentDemo.name,
                    });
                    setListingActionResult({
                      type: 'success',
                      text: `Owner explicitly authorized ${agentDemo.name} for ${unit.unit_name}.`,
                    });
                  }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-semibold"
                >
                  1. Owner Authorize Agent ({agentDemo.name})
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleAttemptUnitListing(
                      unit.id,
                      agentDemo.id,
                      agentDemo.name,
                      'agent'
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
                >
                  2. List as Authorized Agent (Links to Owner)
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* C3: 11-Point Condition Checklist Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-emerald-700" />
              C3. 11-Point Condition Checklists ({bld.checklists.length})
            </h2>
            <p className="text-xs text-slate-500">
              Every checklist is explicitly labelled <code>self-declared</code> (when submitted by
              owner/agent) or <code>inspected by &lt;inspector&gt;</code> (when submitted by an
              inspector).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowChecklistForm((s) => !s)}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
          >
            {showChecklistForm
              ? 'Cancel Checklist'
              : `Record New Checklist (as ${user?.role === 'inspector' ? `inspected by ${user.name}` : 'self-declared'})`}
          </button>
        </div>

        {showChecklistForm && (
          <form
            onSubmit={handleCreateChecklist}
            className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {MANDATORY_CONDITION_CATEGORIES.map((cat) => (
                <div
                  key={cat.id}
                  className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2"
                >
                  <span className="font-semibold text-slate-800 w-40">{cat.label}</span>
                  <select
                    value={checklistRatings[cat.id].rating}
                    onChange={(e) =>
                      setChecklistRatings((prev) => ({
                        ...prev,
                        [cat.id]: {
                          ...prev[cat.id],
                          rating: e.target.value as ConditionRating,
                        },
                      }))
                    }
                    className="rounded border border-slate-300 px-2 py-1 font-semibold"
                  >
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                    <option value="not_checked">Not Checked</option>
                  </select>
                  <input
                    type="text"
                    value={checklistRatings[cat.id].notes}
                    onChange={(e) =>
                      setChecklistRatings((prev) => ({
                        ...prev,
                        [cat.id]: { ...prev[cat.id], notes: e.target.value },
                      }))
                    }
                    className="flex-1 rounded border border-slate-300 px-2 py-1"
                    placeholder="Notes..."
                  />
                </div>
              ))}
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-700 text-white font-semibold"
            >
              Submit 11-Item Condition Checklist
            </button>
          </form>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {bld.checklists.map((chk) => (
            <div
              key={chk.id}
              className="rounded-xl border border-slate-200 p-4 bg-slate-50/60 space-y-3 text-xs"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`px-2.5 py-1 rounded-full font-bold uppercase text-[11px] ${
                    chk.declaration_label.startsWith('inspected by')
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                  }`}
                >
                  {chk.declaration_label}
                </span>
                <span className="text-slate-400">
                  {new Date(chk.created_at).toLocaleDateString()}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {chk.items.map((item, i) => (
                  <div
                    key={i}
                    className="p-2 rounded bg-white border border-slate-200 flex items-center justify-between gap-2"
                  >
                    <div>
                      <span className="font-semibold text-slate-800 capitalize block">
                        {item.category.replace('_', ' / ')}
                      </span>
                      <span className="text-[10px] text-slate-500">{item.notes}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                        item.rating === 'good'
                          ? 'bg-emerald-50 text-emerald-800'
                          : item.rating === 'fair'
                          ? 'bg-amber-50 text-amber-800'
                          : item.rating === 'poor'
                          ? 'bg-rose-50 text-rose-800'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {item.rating}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* C4: Exterior & Per-Room Geotagged Photo Evidence (50m Building Geofence) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Camera className="h-5 w-5 text-emerald-700" />
              C4. Exterior &amp; Per-Room Geotagged Photos (≤50m Building Point Geofence)
            </h2>
          </div>
          <select
            value={selectedRoomForPhoto}
            onChange={(e) => setSelectedRoomForPhoto(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white font-semibold"
          >
            <option value="">Exterior Building Photo</option>
            {bld.units[0]?.rooms.map((r) => (
              <option key={r.id} value={r.room_name}>
                Room: {r.room_name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {bld.photos.map((ph) => (
            <div
              key={ph.id}
              className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50 text-xs"
            >
              <div className="relative h-36 bg-slate-900">
                <img src={ph.preview_url} alt={ph.caption} className="w-full h-full object-cover" />
                <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                  <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold">
                    {ph.room_name || 'Exterior'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-sky-600 text-white text-[10px] font-semibold">
                    {ph.distance_to_building_m}m from entrance
                  </span>
                </div>
              </div>
              <div className="p-2.5 space-y-0.5">
                <p className="font-semibold text-slate-900">{ph.caption}</p>
                <p className="text-[10px] text-slate-500">
                  Badge: {ph.capture_source.replace('_', ' ')} · pHash: {ph.perceptual_hash}
                </p>
              </div>
            </div>
          ))}
        </div>

        <InAppCamera
          plotCenterLat={bld.entrance_lat}
          plotCenterLon={bld.entrance_lon}
          onCapturePhoto={(payload) =>
            addBuildingPhoto({
              building_id: bld.id,
              unit_id: bld.units[0]?.id,
              room_name: selectedRoomForPhoto || undefined,
              actor_id: user?.id || bld.owner_id,
              ...payload,
            })
          }
        />
      </div>

      {/* C6 & C7: Ownership Claim Timeline + Construction/Maintenance Monitoring */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* C6: Ownership / Status Claim Timeline */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <History className="h-5 w-5 text-indigo-700" />
              C6. Ownership &amp; Status Claim Timeline
            </h2>
            <p className="text-xs text-slate-500">
              Transfers and status changes are recorded as claims with documents, reviewed by Admin,
              and logged in the audit chain. The platform never asserts legal title.
            </p>
          </div>

          <div className="space-y-2.5">
            {bld.ownership_claims.map((c) => {
              const stCfg = EVIDENCE_STATUS_CONFIG[c.status];
              return (
                <div
                  key={c.id}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 uppercase">
                      {c.claim_type.replace(/_/g, ' ')}
                    </span>
                    <span className={`px-2 py-0.5 rounded font-semibold ${stCfg.badgeClass}`}>
                      {stCfg.label}
                    </span>
                  </div>
                  <p className="text-slate-700">{c.summary}</p>
                  <p className="text-[11px] text-slate-500">
                    Document Ref: <code>{c.document_ref}</code> · By {c.claimant_name}
                  </p>
                  {isAdmin && (
                    <div className="pt-1 flex items-center gap-2">
                      <select
                        value={c.status}
                        onChange={(e) =>
                          adminReviewOwnershipClaim({
                            building_id: bld.id,
                            claim_id: c.id,
                            status: e.target.value as EvidenceStatus,
                            admin_notes: `Reviewed by Admin (${user?.name})`,
                            actor_id: user?.id || 'usr-admin-1',
                          })
                        }
                        className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 text-[11px] font-semibold"
                      >
                        <option value="uploaded">Uploaded</option>
                        <option value="under_review">Under Review</option>
                        <option value="reviewed_by_admin">Reviewed by Admin</option>
                        <option value="externally_verified">Externally Verified</option>
                      </select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <form onSubmit={handleAddOwnershipClaim} className="space-y-2 pt-2 border-t border-slate-100 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <select
                value={claimType}
                onChange={(e) =>
                  setClaimType(
                    e.target.value as
                      | 'initial_claim'
                      | 'transfer_of_interest'
                      | 'lease_status_update'
                      | 'encumbrance_note'
                  )
                }
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white"
              >
                <option value="transfer_of_interest">Transfer of Interest Claim</option>
                <option value="lease_status_update">Lease Status Update</option>
                <option value="encumbrance_note">Encumbrance / Caution Note</option>
              </select>
              <input
                type="text"
                placeholder="Document Ref (e.g. OY-DEED-2026)"
                value={claimDocRef}
                onChange={(e) => setClaimDocRef(e.target.value)}
                className="rounded-lg border border-slate-300 px-2.5 py-1.5"
              />
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Describe claim & attached instrument..."
                value={claimSummary}
                onChange={(e) => setClaimSummary(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg bg-slate-900 text-white font-semibold"
              >
                Record Claim
              </button>
            </div>
          </form>
        </div>

        {/* C7: Construction & Maintenance Monitoring Timeline (Plot -> Building) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-emerald-700" />
                C7. Construction &amp; Maintenance Monitoring Timeline
              </h2>
              <p className="text-xs text-slate-500">
                Dated, geotagged timeline linking Plot ({bld.plot_id || 'Standalone'}) &rarr;
                Building ({bld.id}). Re-inspection every {bld.reinspection_interval_days} days.
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {bld.monitoring_entries.map((m) => (
              <div
                key={m.id}
                className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs flex gap-3"
              >
                {m.photo_url && (
                  <img
                    src={m.photo_url}
                    alt={m.stage_label}
                    className="w-16 h-16 rounded-lg object-cover shrink-0"
                  />
                )}
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase text-emerald-700">
                    {m.entry_type.replace(/_/g, ' ')} ·{' '}
                    {new Date(m.captured_at).toLocaleDateString()}
                  </span>
                  <div className="font-bold text-slate-900">{m.stage_label}</div>
                  <p className="text-slate-600">{m.notes}</p>
                  <span className="text-[10px] text-slate-400 block">
                    GPS: {m.lat.toFixed(5)}°N, {m.lon.toFixed(5)}°E · By {m.author_name}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddMonitoring} className="space-y-2 pt-2 border-t border-slate-100 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <select
                value={monType}
                onChange={(e) =>
                  setMonType(
                    e.target.value as
                      | 'construction_milestone'
                      | 'maintenance_log'
                      | 'reinspection_check'
                  )
                }
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white"
              >
                <option value="construction_milestone">Construction Milestone</option>
                <option value="maintenance_log">Maintenance Log</option>
                <option value="reinspection_check">Routine Re-Inspection Check</option>
              </select>
              <input
                type="text"
                placeholder="Stage / Milestone Label"
                value={monStageLabel}
                onChange={(e) => setMonStageLabel(e.target.value)}
                className="rounded-lg border border-slate-300 px-2.5 py-1.5"
              />
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Geotagged site observation notes..."
                value={monNotes}
                onChange={(e) => setMonNotes(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg bg-emerald-700 text-white font-semibold"
              >
                Log Entry
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

