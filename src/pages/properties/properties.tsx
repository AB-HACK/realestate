import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDataStore } from '../../stores/data-store';
import { useAuthStore } from '../../stores/auth-store';
import { useCurrencyStore } from '../../stores/currency-store';
import { EvidenceCompletenessPanel } from '../../components/evidence/evidence-completeness-panel';
import { NIGERIA_STATES_LGAS, MEASUREMENT_DISCLAIMER } from '../../lib/nigeria-data';
import {
  Search,
  Plus,
  MapPin,
  ShieldAlert,
  ArrowUpRight,
  Lock,
} from 'lucide-react';

export const Properties: React.FC = () => {
  const { plots } = useDataStore();
  const { user } = useAuthStore();
  const { formatPrice } = useCurrencyStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedState, setSelectedState] = useState('ALL');
  const [selectedPurpose, setSelectedPurpose] = useState('ALL');
  const [selectedMethod, setSelectedMethod] = useState('ALL');

  const filteredPlots = plots.filter((plot) => {
    const matchesSearch =
      plot.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plot.area_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plot.lga.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesState = selectedState === 'ALL' || plot.state === selectedState;
    const matchesPurpose = selectedPurpose === 'ALL' || plot.purpose === selectedPurpose;
    const matchesMethod =
      selectedMethod === 'ALL' || plot.measurement_method === selectedMethod;
    return matchesSearch && matchesState && matchesPurpose && matchesMethod;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Land &amp; Plot Evidence Registry
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Every listing displays its boundary capture method, geodesic area uncertainty range, and
            itemised document checklist status.
          </p>
        </div>

        {(user?.role === 'owner' || user?.role === 'agent' || user?.role === 'admin') && (
          <Link
            to="/plots/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold shadow-sm transition shrink-0"
          >
            <Plus className="h-4 w-4" />
            Capture New Plot Evidence
          </Link>
        )}
      </div>

      {/* Mandatory Disclaimer Banner */}
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-2.5 text-xs text-amber-900 font-medium">
        <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0" />
        <span>{MEASUREMENT_DISCLAIMER}</span>
      </div>

      {/* Filters Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search title, area, LGA..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-emerald-600 focus:outline-none"
          />
        </div>

        <select
          value={selectedState}
          onChange={(e) => setSelectedState(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 bg-white focus:border-emerald-600 focus:outline-none"
        >
          <option value="ALL">All Nigerian States</option>
          {Object.keys(NIGERIA_STATES_LGAS).map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>

        <select
          value={selectedPurpose}
          onChange={(e) => setSelectedPurpose(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 bg-white focus:border-emerald-600 focus:outline-none"
        >
          <option value="ALL">All Purposes (Sale / Lease / Construction)</option>
          <option value="sale">For Sale</option>
          <option value="lease">For Lease</option>
          <option value="construction">Under Construction</option>
        </select>

        <select
          value={selectedMethod}
          onChange={(e) => setSelectedMethod(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 bg-white focus:border-emerald-600 focus:outline-none"
        >
          <option value="ALL">All Boundary Capture Methods</option>
          <option value="gps_walk">GPS Boundary Walk</option>
          <option value="satellite_trace">Satellite Trace (Lower Confidence)</option>
          <option value="surveyor_plan">Surveyor Plan Upload</option>
        </select>
      </div>

      {/* Plot Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filteredPlots.map((plot) => {
          const heroPhoto =
            plot.photos[0]?.preview_url ||
            'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80';

          return (
            <div
              key={plot.id}
              className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col justify-between hover:border-emerald-300 transition"
            >
              <div>
                {/* Image Header */}
                <div className="relative h-48 bg-slate-900 overflow-hidden">
                  <img
                    src={heroPhoto}
                    alt={plot.title}
                    className="w-full h-full object-cover opacity-90"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent" />

                  <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
                    <span className="px-2.5 py-1 rounded-md bg-slate-900/85 text-white text-xs font-semibold uppercase tracking-wide">
                      {plot.purpose}
                    </span>
                    {plot.is_occupied_home && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/90 text-slate-950 text-xs font-semibold">
                        <Lock className="h-3 w-3" />
                        NDPA ~300m Fuzzed Location
                      </span>
                    )}
                  </div>

                  <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2 text-white">
                    <div>
                      <h2 className="text-base font-bold leading-snug">{plot.title}</h2>
                      <p className="text-xs text-slate-200 flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        {plot.area_name}, {plot.lga}, {plot.state}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-lg font-extrabold text-emerald-300 block">
                        {formatPrice(plot.asking_price, plot.currency)}
                      </span>
                      <span className="text-[10px] text-slate-300">
                        {plot.computed_area_hectares.toFixed(4)} ha ·{' '}
                        {plot.computed_area_acres.toFixed(3)} ac
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3">
                  <p className="text-xs text-slate-600 line-clamp-2">{plot.description}</p>
                  <EvidenceCompletenessPanel plot={plot} compact />
                </div>
              </div>

              {/* Card Footer */}
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  Perimeter: <strong>{plot.computed_perimeter_m} m</strong> · Custom plot scale:{' '}
                  <strong>{plot.sqm_per_plot} m²/plot</strong>
                </span>
                <Link
                  to={`/plots/${plot.id}`}
                  className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-900"
                >
                  Open Full Dossier
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
