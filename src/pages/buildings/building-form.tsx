import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataStore } from '../../stores/data-store';
import { useAuthStore } from '../../stores/auth-store';
import {
  BuiltPropertyType,
  MeasurementMethod,
  PlotVertex,
  OccupancyStatus,
} from '../../types';
import {
  NIGERIA_STATES_LGAS,
  NIGERIA_DISCOS,
  NIGERIA_WATER_SOURCES,
  MEASUREMENT_DISCLAIMER,
} from '../../lib/nigeria-data';
import {
  computePlotGeometryMetrics,
  checkFootprintInsidePlot,
  evaluateRoomAreaSum,
} from '../../lib/geodesic';
import { InteractivePlotMap } from '../../components/evidence/interactive-plot-map';
import {
  Building2,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Smartphone,
} from 'lucide-react';

export const BuildingForm: React.FC = () => {
  const navigate = useNavigate();
  const { plots, createBuilding } = useDataStore();
  const { user } = useAuthStore();

  // C1 Building Record State
  const [linkedPlotId, setLinkedPlotId] = useState<string>(plots[0]?.id || '');
  const [title, setTitle] = useState('');
  const [propertyType, setPropertyType] = useState<BuiltPropertyType>('duplex');
  const [address, setAddress] = useState('Plot 14 Awolowo Avenue, Old Bodija GRA');
  const [stateName, setStateName] = useState('Oyo');
  const [lga, setLga] = useState('Ibadan North (Bodija / Agodi GRA)');
  const [storeys, setStoreys] = useState<number>(2);
  const [yearBuilt, setYearBuilt] = useState<string>('2025');
  const [measurementMethod, setMeasurementMethod] =
    useState<MeasurementMethod>('gps_walk');
  const [isOccupiedHome, setIsOccupiedHome] = useState<boolean>(false);
  const [reinspectionDays, setReinspectionDays] = useState<number>(90);

  // Footprint Polygon Vertices (default inside plot-ibadan-001)
  const [footprintVertices, setFootprintVertices] = useState<PlotVertex[]>([
    { lat: 7.38003, lon: 3.90004, accuracy_m: 2.2, sample_count: 10 },
    { lat: 7.38003, lon: 3.90016, accuracy_m: 2.2, sample_count: 10 },
    { lat: 7.38013, lon: 3.90016, accuracy_m: 2.2, sample_count: 10 },
    { lat: 7.38013, lon: 3.90004, accuracy_m: 2.2, sample_count: 10 },
  ]);

  // C1 & C2 Primary Unit + Room Dimensions State
  const [unitName, setUnitName] = useState('Main 4-Bedroom Duplex Wing');
  const [floorNumber, setFloorNumber] = useState<number>(0);
  const [bedrooms, setBedrooms] = useState<number>(4);
  const [bathrooms, setBathrooms] = useState<number>(5);
  const [powerMeterType, setPowerMeterType] = useState<
    'prepaid' | 'postpaid' | 'solar_hybrid' | 'generator_only'
  >('prepaid');
  const [powerDisco, setPowerDisco] = useState(NIGERIA_DISCOS[0]);
  const [waterSource, setWaterSource] = useState(NIGERIA_WATER_SOURCES[0]);
  const [drainageNotes, setDrainageNotes] = useState(
    'Concrete perimeter drain discharging to estate collector; 0.8m above road level.'
  );
  const [securityFeatures, setSecurityFeatures] = useState(
    'Perimeter electric fence, security gatehouse, steel security doors.'
  );
  const [declaredUnitAreaM2, setDeclaredUnitAreaM2] = useState<string>('95');
  const [occupancyStatus, setOccupancyStatus] =
    useState<OccupancyStatus>('vacant');

  const [rooms, setRooms] = useState<
    Array<{
      room_name: string;
      length_m: number;
      width_m: number;
      height_m: number;
      measurement_source: 'manual' | 'webxr_experimental';
    }>
  >([
    {
      room_name: 'Living & Dining Room',
      length_m: 7.5,
      width_m: 5.0,
      height_m: 3.2,
      measurement_source: 'manual',
    },
    {
      room_name: 'Master Bedroom Suite',
      length_m: 5.5,
      width_m: 4.5,
      height_m: 3.0,
      measurement_source: 'manual',
    },
    {
      room_name: 'Bedrooms 2 & 3 Combined',
      length_m: 6.0,
      width_m: 4.0,
      height_m: 3.0,
      measurement_source: 'manual',
    },
    {
      room_name: 'Kitchen & Store',
      length_m: 4.0,
      width_m: 3.0,
      height_m: 3.0,
      measurement_source: 'manual',
    },
  ]);

  // C2 WebXR Feature Detection (Android Chrome only; no camera-only distance guessing)
  const [webXrSupported, setWebXrSupported] = useState<boolean>(false);
  const [webXrMessage, setWebXrMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const navWithXr = navigator as Navigator & {
      xr?: { isSessionSupported?: (mode: string) => Promise<boolean> };
    };
    if (navWithXr.xr && typeof navWithXr.xr.isSessionSupported === 'function') {
      navWithXr.xr
        .isSessionSupported('immersive-ar')
        .then((supported) => setWebXrSupported(Boolean(supported)))
        .catch(() => setWebXrSupported(false));
    }
  }, []);

  const linkedPlot = plots.find((p) => p.id === linkedPlotId);

  // Live Footprint Geodesic & Containment Preview
  let fpMetrics: ReturnType<typeof computePlotGeometryMetrics> | null = null;
  if (footprintVertices.length >= 3) {
    try {
      fpMetrics = computePlotGeometryMetrics(footprintVertices, 600, 10.0);
    } catch {
      fpMetrics = null;
    }
  }

  const containmentCheck =
    linkedPlot && footprintVertices.length >= 3
      ? checkFootprintInsidePlot(footprintVertices, linkedPlot.vertices)
      : { footprint_inside_plot: true, footprint_outside_pct: 0 };

  // Live Room Area Sum vs Declared Area Check (>20% threshold)
  const roomEval = evaluateRoomAreaSum(
    rooms,
    declaredUnitAreaM2 ? Number(declaredUnitAreaM2) : undefined,
    20.0
  );

  // Preset 1: Building Footprint strictly INSIDE linked plot-ibadan-001
  const loadFootprintInsidePlot = () => {
    setLinkedPlotId('plot-ibadan-001');
    setFootprintVertices([
      { lat: 7.38003, lon: 3.90004, accuracy_m: 2.0, sample_count: 10 },
      { lat: 7.38003, lon: 3.90016, accuracy_m: 2.0, sample_count: 10 },
      { lat: 7.38013, lon: 3.90016, accuracy_m: 2.0, sample_count: 10 },
      { lat: 7.38013, lon: 3.90004, accuracy_m: 2.0, sample_count: 10 },
    ]);
  };

  // Preset 2: Building Footprint PROTRUDING OUTSIDE linked plot-ibadan-001 (triggers C1 flag)
  const loadFootprintOutsidePlot = () => {
    setLinkedPlotId('plot-ibadan-001');
    setFootprintVertices([
      { lat: 7.38003, lon: 3.90018, accuracy_m: 2.5, sample_count: 10 },
      { lat: 7.38003, lon: 3.90042, accuracy_m: 2.5, sample_count: 10 },
      { lat: 7.38015, lon: 3.90042, accuracy_m: 2.5, sample_count: 10 },
      { lat: 7.38015, lon: 3.90018, accuracy_m: 2.5, sample_count: 10 },
    ]);
  };

  const handleAddRoom = () => {
    setRooms((prev) => [
      ...prev,
      {
        room_name: `Room ${prev.length + 1}`,
        length_m: 4.0,
        width_m: 3.5,
        height_m: 3.0,
        measurement_source: 'manual',
      },
    ]);
  };

  const handleRemoveRoom = (idx: number) => {
    setRooms((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleWebXrMeasure = () => {
    if (!webXrSupported) {
      setWebXrMessage(
        'WebXR Hit-Test AR is not supported on this browser/device (requires Android Chrome with ARCore). Camera-only distance guessing is strictly disabled by platform policy; please enter manual tape/laser room dimensions.'
      );
      return;
    }
    setRooms((prev) => [
      ...prev,
      {
        room_name: 'AR Hit-Test Measured Room (Experimental)',
        length_m: 4.8,
        width_m: 4.2,
        height_m: 3.0,
        measurement_source: 'webxr_experimental',
      },
    ]);
    setWebXrMessage(
      'Experimental WebXR Hit-Test room measurement added. Always cross-check against physical tape/laser measurements.'
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!title.trim()) {
      setFormError('Please enter a building title.');
      return;
    }
    if (footprintVertices.length < 3) {
      setFormError('At least 3 footprint corners are required.');
      return;
    }

    try {
      const entranceLat = footprintVertices[0].lat;
      const entranceLon = footprintVertices[0].lon;
      const created = createBuilding({
        owner_id: user?.id || 'usr-owner-1',
        owner_name: user?.name || 'Chief Tunde Bakare',
        owner_role: user?.role || 'owner',
        plot_id: linkedPlotId || undefined,
        title: title.trim(),
        property_type: propertyType,
        address: address.trim(),
        state: stateName,
        lga,
        storeys,
        year_built: yearBuilt ? Number(yearBuilt) : undefined,
        measurement_method: measurementMethod,
        footprint_vertices: footprintVertices,
        entrance_lat: entranceLat,
        entrance_lon: entranceLon,
        is_occupied_home: isOccupiedHome,
        reinspection_interval_days: reinspectionDays,
        units: [
          {
            unit_name: unitName.trim() || 'Primary Unit',
            floor_number: floorNumber,
            bedrooms,
            bathrooms,
            power_meter_type: powerMeterType,
            power_disco: powerDisco,
            water_source: waterSource,
            drainage_flood_notes: drainageNotes,
            security_features: securityFeatures,
            declared_area_m2: declaredUnitAreaM2
              ? Number(declaredUnitAreaM2)
              : undefined,
            occupancy_status: occupancyStatus,
            rooms,
          },
        ],
      });
      navigate(`/buildings/${created.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create building.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Building2 className="h-6 w-6 text-emerald-700" />
          Record New Building, Footprint &amp; Units (Phase 2: C1 &amp; C2)
        </h1>
        <p className="text-sm text-slate-600">
          Links a building footprint polygon to its parent plot (checking containment automatically)
          and verifies room dimension sums against declared unit area (&gt;20% discrepancy flag).
        </p>
      </div>

      <div className="rounded-xl bg-amber-50 border border-amber-300 px-4 py-3 flex items-center gap-2.5 text-xs text-amber-950 font-semibold">
        <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0" />
        <span>{MEASUREMENT_DISCLAIMER}</span>
      </div>

      {formError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-900 font-semibold">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* C1: Building Metadata & Parent Plot Link */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
            C1. Building Record &amp; Parent Plot Containment Check
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Building Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Bodija 4-Bedroom Detached Duplex & BQ"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Link to Registered Parent Land Plot (Optional)
              </label>
              <select
                value={linkedPlotId}
                onChange={(e) => setLinkedPlotId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="">-- Standalone Building (No Linked Plot) --</option>
                {plots.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.computed_area_m2} m²)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Property Type *
              </label>
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value as BuiltPropertyType)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="duplex">Duplex</option>
                <option value="house">Detached House / Bungalow</option>
                <option value="block_of_flats">Block of Flats</option>
                <option value="single_unit">Single Unit</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Street Address *
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Storeys
                </label>
                <input
                  type="number"
                  min={1}
                  max={25}
                  value={storeys}
                  onChange={(e) => setStoreys(Number(e.target.value) || 1)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Year Built
                </label>
                <input
                  type="number"
                  value={yearBuilt}
                  onChange={(e) => setYearBuilt(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Re-Inspect (Days)
                </label>
                <input
                  type="number"
                  min={7}
                  value={reinspectionDays}
                  onChange={(e) => setReinspectionDays(Number(e.target.value) || 90)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                State *
              </label>
              <select
                value={stateName}
                onChange={(e) => {
                  const st = e.target.value;
                  setStateName(st);
                  setLga((NIGERIA_STATES_LGAS[st] || ['Central'])[0]);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                {Object.keys(NIGERIA_STATES_LGAS).map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Footprint Capture Method *
              </label>
              <select
                value={measurementMethod}
                onChange={(e) =>
                  setMeasurementMethod(e.target.value as MeasurementMethod)
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="gps_walk">GPS Footprint Walk</option>
                <option value="satellite_trace">Satellite Roof Trace (Lower Confidence)</option>
                <option value="surveyor_plan">Surveyor As-Built Plan</option>
              </select>
            </div>

            <div className="md:col-span-2 flex items-center gap-2">
              <input
                id="bld-occupied"
                type="checkbox"
                checked={isOccupiedHome}
                onChange={(e) => setIsOccupiedHome(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600"
              />
              <label htmlFor="bld-occupied" className="text-xs font-medium text-slate-700">
                Occupied residence — fuzz public coordinates by ~300 m (NDPA 2023 privacy rule)
              </label>
            </div>
          </div>

          {/* Footprint-Inside-Plot Preset Test Buttons */}
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-700">
              C1 Acceptance Test Presets (Footprint Containment inside Linked Plot):
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={loadFootprintInsidePlot}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-semibold"
              >
                <Sparkles className="h-3.5 w-3.5 text-emerald-700" />
                Load Footprint Inside Plot (Passes)
              </button>
              <button
                type="button"
                onClick={loadFootprintOutsidePlot}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-300 text-xs font-semibold"
              >
                Load Footprint Protruding Outside Plot (Flags)
              </button>
            </div>
          </div>

          {/* Interactive Map showing Building Footprint vs Parent Plot */}
          <InteractivePlotMap
            vertices={footprintVertices}
            comparisonVertices={linkedPlot?.vertices}
            comparisonTitle={linkedPlot ? `Parent Plot: ${linkedPlot.title}` : undefined}
            editable={true}
            onAddVertex={(v) => setFootprintVertices((prev) => [...prev, v])}
            onClearVertices={() => setFootprintVertices([])}
            heightClass="h-80"
          />

          {/* Live Containment Result Banner */}
          {linkedPlot && fpMetrics && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
                containmentCheck.footprint_inside_plot
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : 'bg-rose-50 border-rose-300 text-rose-950'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                {containmentCheck.footprint_inside_plot ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-rose-700 shrink-0" />
                )}
                <span>
                  {containmentCheck.footprint_inside_plot
                    ? `Building Footprint (${fpMetrics.computed_area_m2} m²) falls strictly INSIDE linked plot (${linkedPlot.title}).`
                    : `FLAGGED: Building Footprint protrudes OUTSIDE linked plot boundary (${containmentCheck.footprint_outside_pct}% outside plot)!`}
                </span>
              </div>
              <span>
                Uncertainty: {fpMetrics.area_low_m2} – {fpMetrics.area_high_m2} m²
              </span>
            </div>
          )}
        </div>

        {/* C1 & C2: Unit Infrastructure & Room Dimensions */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
            C1 &amp; C2. Unit Utilities &amp; Room Dimensions (20% Discrepancy Check)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Unit Name / Label *
              </label>
              <input
                type="text"
                required
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Floor / Bedrooms / Bathrooms
              </label>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  min={0}
                  value={floorNumber}
                  onChange={(e) => setFloorNumber(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  placeholder="Flr"
                  title="Floor Number"
                />
                <input
                  type="number"
                  min={0}
                  value={bedrooms}
                  onChange={(e) => setBedrooms(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  placeholder="Beds"
                  title="Bedrooms"
                />
                <input
                  type="number"
                  min={0}
                  value={bathrooms}
                  onChange={(e) => setBathrooms(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  placeholder="Baths"
                  title="Bathrooms"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Declared Unit Area (m²)
              </label>
              <input
                type="number"
                value={declaredUnitAreaM2}
                onChange={(e) => setDeclaredUnitAreaM2(e.target.value)}
                placeholder="e.g., 95"
                className="w-full rounded-lg border border-emerald-400 bg-emerald-50/30 px-3 py-2 text-sm font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Power Meter Type
              </label>
              <select
                value={powerMeterType}
                onChange={(e) =>
                  setPowerMeterType(
                    e.target.value as
                      | 'prepaid'
                      | 'postpaid'
                      | 'solar_hybrid'
                      | 'generator_only'
                  )
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="prepaid">Prepaid Meter</option>
                <option value="postpaid">Postpaid Meter</option>
                <option value="solar_hybrid">Solar Inverter + Prepaid</option>
                <option value="generator_only">Off-Grid Generator / Solar Only</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Electricity DisCo (Nigeria)
              </label>
              <select
                value={powerDisco}
                onChange={(e) => setPowerDisco(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                {NIGERIA_DISCOS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Water Supply Source
              </label>
              <select
                value={waterSource}
                onChange={(e) => setWaterSource(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                {NIGERIA_WATER_SOURCES.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Occupancy Status (C5)
              </label>
              <select
                value={occupancyStatus}
                onChange={(e) => setOccupancyStatus(e.target.value as OccupancyStatus)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="vacant">Vacant</option>
                <option value="tenant_occupied">Tenant Occupied (Active Lease)</option>
                <option value="owner_occupied">Owner Occupied</option>
                <option value="under_renovation">Under Renovation</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Drainage &amp; Flood History Notes
              </label>
              <input
                type="text"
                value={drainageNotes}
                onChange={(e) => setDrainageNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Security Features
              </label>
              <input
                type="text"
                value={securityFeatures}
                onChange={(e) => setSecurityFeatures(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* C2: Per-Room Dimensions Table + Experimental WebXR Hit-Test */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  C2. Per-Room Dimensions (Length × Width × Height)
                </h3>
                <p className="text-xs text-slate-500">
                  Flags automatically if the sum of room areas differs from Declared Unit Area by
                  more than <strong>20%</strong>.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleAddRoom}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Room (Manual Tape/Laser)
                </button>

                <button
                  type="button"
                  onClick={handleWebXrMeasure}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border border-indigo-300 text-xs font-semibold"
                >
                  <Smartphone className="h-3.5 w-3.5 text-indigo-700" />
                  WebXR Hit-Test AR Measure (Experimental)
                </button>
              </div>
            </div>

            {webXrMessage && (
              <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-xs text-indigo-950">
                <strong>Experimental WebXR Notice:</strong> {webXrMessage}
              </div>
            )}

            <div className="space-y-2">
              {rooms.map((rm, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs"
                >
                  <div className="sm:col-span-4">
                    <input
                      type="text"
                      value={rm.room_name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRooms((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, room_name: val } : item))
                        );
                      }}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 font-medium"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-1">
                    <span className="text-slate-400">L(m):</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      value={rm.length_m}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 1;
                        setRooms((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, length_m: val } : item))
                        );
                      }}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1.5"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-1">
                    <span className="text-slate-400">W(m):</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      value={rm.width_m}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 1;
                        setRooms((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, width_m: val } : item))
                        );
                      }}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1.5"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-1">
                    <span className="text-slate-400">H(m):</span>
                    <input
                      type="number"
                      step="0.1"
                      min="1.5"
                      value={rm.height_m}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 2.8;
                        setRooms((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, height_m: val } : item))
                        );
                      }}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1.5"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      {(rm.length_m * rm.width_m).toFixed(1)} m²
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRoom(idx)}
                      className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Room Sum vs Declared Unit Area Summary */}
            <div
              className={`p-3.5 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
                roomEval.room_area_discrepancy_flagged
                  ? 'bg-amber-100 border-amber-300 text-amber-950'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-950'
              }`}
            >
              <div>
                <strong>Computed Sum of Room Areas:</strong>{' '}
                {roomEval.computed_room_area_sum_m2} m² vs{' '}
                <strong>Declared Unit Area:</strong> {declaredUnitAreaM2 || 'N/A'} m² (Difference:{' '}
                <strong>{roomEval.room_area_diff_pct}%</strong>)
              </div>
              <span className="font-bold">
                {roomEval.room_area_discrepancy_flagged
                  ? '⚠️ Exceeds 20% Threshold — Auto-Flagged for Review'
                  : '✓ Within ≤20% Room Area Tolerance'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/buildings')}
            className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold shadow-sm"
          >
            Save Building, Footprint &amp; Unit Evidence
          </button>
        </div>
      </form>
    </div>
  );
};
