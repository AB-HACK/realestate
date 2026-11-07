import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDataStore } from '../../stores/data-store';
import { useAuthStore } from '../../stores/auth-store';
import { useCurrencyStore } from '../../stores/currency-store';
import {
  BUILT_PROPERTY_TYPE_LABELS,
  MEASUREMENT_DISCLAIMER,
  NIGERIA_STATES_LGAS,
} from '../../lib/nigeria-data';
import {
  Building2,
  Plus,
  MapPin,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Droplets,
  ArrowUpRight,
  Lock,
} from 'lucide-react';

export const Buildings: React.FC = () => {
  const { buildings, plots } = useDataStore();
  const { user } = useAuthStore();
  const { formatPrice } = useCurrencyStore();

  const [selectedState, setSelectedState] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');

  const filtered = buildings.filter((b) => {
    const matchState = selectedState === 'ALL' || b.state === selectedState;
    const matchType = selectedType === 'ALL' || b.property_type === selectedType;
    return matchState && matchType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-emerald-700" />
            Built Houses, Duplexes &amp; Apartments Registry (Phase 2)
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Building &rarr; Units hierarchy with footprint-inside-plot checks, room dimension
            verification, 11-point condition checklists, and the One-Active-Listing Rule.
          </p>
        </div>

        {(user?.role === 'owner' || user?.role === 'agent' || user?.role === 'admin') && (
          <Link
            to="/buildings/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold shadow-sm transition shrink-0"
          >
            <Plus className="h-4 w-4" />
            Record New Building &amp; Units
          </Link>
        )}
      </div>

      {/* Mandatory Disclaimer */}
      <div className="rounded-xl bg-amber-50 border border-amber-300 px-4 py-3 flex items-center gap-2.5 text-xs text-amber-950 font-semibold">
        <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0" />
        <span>{MEASUREMENT_DISCLAIMER}</span>
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-3">
        <select
          value={selectedState}
          onChange={(e) => setSelectedState(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
        >
          <option value="ALL">All Nigerian States</option>
          {Object.keys(NIGERIA_STATES_LGAS).map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
        >
          <option value="ALL">All Built Property Types</option>
          <option value="house">Detached House / Bungalow</option>
          <option value="duplex">Duplex</option>
          <option value="block_of_flats">Block of Flats</option>
          <option value="single_unit">Single Unit</option>
        </select>
      </div>

      {/* Building Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filtered.map((bld) => {
          const linkedPlot = plots.find((p) => p.id === bld.plot_id);
          const heroImg =
            bld.photos[0]?.preview_url ||
            'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80';
          const primaryUnit = bld.units[0];
          const primaryListing = primaryUnit?.active_listings.find((l) => l.is_primary_active);
          const openConflicts = bld.units.reduce(
            (sum, u) => sum + u.conflicting_claims.filter((c) => c.status === 'open').length,
            0
          );
          const latestChecklist = bld.checklists[0];

          return (
            <div
              key={bld.id}
              className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col justify-between hover:border-emerald-300 transition"
            >
              <div>
                <div className="relative h-48 bg-slate-900 overflow-hidden">
                  <img
                    src={heroImg}
                    alt={bld.title}
                    className="w-full h-full object-cover opacity-90"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent" />

                  <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                    <span className="px-2.5 py-1 rounded-md bg-slate-900/90 text-white text-xs font-semibold">
                      {BUILT_PROPERTY_TYPE_LABELS[bld.property_type] || bld.property_type} ·{' '}
                      {bld.storeys} Storey(s)
                    </span>
                    {bld.is_occupied_home && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/90 text-slate-950 text-xs font-semibold">
                        <Lock className="h-3 w-3" />
                        NDPA ~300m Fuzzed
                      </span>
                    )}
                  </div>

                  <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2 text-white">
                    <div>
                      <h2 className="text-base font-bold">{bld.title}</h2>
                      <p className="text-xs text-slate-200 flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        {bld.address} ({bld.state})
                      </p>
                    </div>
                    {primaryListing && (
                      <div className="text-right shrink-0">
                        <span className="text-lg font-extrabold text-emerald-300 block">
                          {formatPrice(primaryListing.asking_price, primaryListing.currency)}
                        </span>
                        <span className="text-[10px] text-slate-300 uppercase">
                          For {primaryListing.listing_type}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Evidence Signals Body */}
                <div className="p-4 space-y-3 text-xs">
                  {/* Footprint Containment & Linked Plot */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <div>
                      <span className="text-slate-500 block text-[10px]">
                        Footprint Geodesic Area Range
                      </span>
                      <span className="font-bold text-slate-900">
                        {bld.footprint_area_m2} m² (Range: {bld.footprint_area_low_m2} –{' '}
                        {bld.footprint_area_high_m2} m²)
                      </span>
                    </div>
                    <div>
                      {bld.footprint_inside_plot ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-semibold text-[11px]">
                          <CheckCircle2 className="h-3 w-3" />
                          Inside Linked Plot
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 font-semibold text-[11px]">
                          <AlertTriangle className="h-3 w-3" />
                          Footprint Outside Plot ({bld.footprint_outside_pct}%)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Units & Room Area Sum Status */}
                  {primaryUnit && (
                    <div className="grid grid-cols-2 gap-2 text-slate-700">
                      <div className="p-2 rounded bg-slate-50 border border-slate-200">
                        <span className="text-[10px] text-slate-400 block">
                          Unit &amp; Room Area Sum (C2)
                        </span>
                        <span className="font-semibold text-slate-900">
                          {primaryUnit.unit_name}: {primaryUnit.computed_room_area_sum_m2} m²
                        </span>
                        {primaryUnit.room_area_discrepancy_flagged && (
                          <span className="block text-[10px] text-amber-800 font-semibold">
                            ⚠️ &gt;20% diff vs declared ({primaryUnit.room_area_diff_pct}%)
                          </span>
                        )}
                      </div>

                      <div className="p-2 rounded bg-slate-50 border border-slate-200">
                        <span className="text-[10px] text-slate-400 block">
                          Power &amp; Water Infrastructure
                        </span>
                        <span className="font-semibold text-slate-900 flex items-center gap-1 truncate">
                          <Zap className="h-3 w-3 text-amber-600 shrink-0" />
                          {primaryUnit.power_meter_type.toUpperCase()} ·{' '}
                          {primaryUnit.power_disco.split(' ')[0]}
                        </span>
                        <span className="text-[10px] text-slate-600 flex items-center gap-1 truncate">
                          <Droplets className="h-3 w-3 text-sky-600 shrink-0" />
                          {primaryUnit.water_source}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Checklist & C5 One-Active-Listing Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {latestChecklist && (
                      <span
                        className={`px-2 py-0.5 rounded font-semibold text-[10px] ${
                          latestChecklist.declaration_label.startsWith('inspected by')
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : 'bg-slate-200 text-slate-800'
                        }`}
                      >
                        Checklist: {latestChecklist.declaration_label}
                      </span>
                    )}
                    {openConflicts > 0 && (
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 font-semibold text-[10px]">
                        {openConflicts} Blocked Duplicate Listing Claim(s)
                      </span>
                    )}
                    {linkedPlot && (
                      <Link
                        to={`/plots/${linkedPlot.id}`}
                        className="text-[11px] text-emerald-700 hover:underline font-medium"
                      >
                        Linked Plot: {linkedPlot.title.slice(0, 28)}...
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  {bld.units.length} Unit(s) · {bld.monitoring_entries.length} Monitoring Logs
                </span>
                <Link
                  to={`/buildings/${bld.id}`}
                  className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-900"
                >
                  Inspect Building &amp; Units
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

