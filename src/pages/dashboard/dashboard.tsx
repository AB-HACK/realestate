import React from 'react';
import { Link } from 'react-router-dom';
import { useDataStore } from '../../stores/data-store';
import { useAuthStore } from '../../stores/auth-store';
import { useCurrencyStore } from '../../stores/currency-store';
import {
  Compass,
  ShieldAlert,
  FileCheck2,
  Link2,
  Plus,
  ArrowRight,
  Camera,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { MEASUREMENT_DISCLAIMER, MEASUREMENT_METHOD_CONFIG } from '../../lib/nigeria-data';

export const Dashboard: React.FC = () => {
  const {
    plots,
    buildings,
    inspections,
    agentProfiles,
    paymentReceipts,
    auditEvents,
    auditVerification,
  } = useDataStore();
  const { user } = useAuthStore();
  const { formatPrice } = useCurrencyStore();

  const openSpatialFlagsCount = plots.reduce(
    (sum, p) => sum + p.spatial_flags.filter((f) => f.status === 'open').length,
    0
  );

  const pendingDocReviewsCount = plots.reduce(
    (sum, p) =>
      sum +
      p.documents.filter((d) => d.status === 'uploaded' || d.status === 'under_review').length,
    0
  );

  const externallyVerifiedDocsCount = plots.reduce(
    (sum, p) => sum + p.documents.filter((d) => d.status === 'externally_verified').length,
    0
  );

  const totalGeofencedPhotos = plots.reduce(
    (sum, p) =>
      sum +
      p.photos.filter((ph) => ph.capture_source === 'captured_in_app' && ph.within_geofence).length,
    0
  );

  return (
    <div className="space-y-6">
      {/* Top Evidence Banner */}
      <div className="rounded-2xl bg-slate-900 text-white p-6 shadow-md border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-medium">
              <Compass className="h-3.5 w-3.5" />
              Phases 1, 2 &amp; 3 · Nigerian Land, Building &amp; Trust Evidence Platform
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Welcome, {user?.name || 'Visitor'} ({user?.role.replace('_', '/')})
            </h1>
            <p className="text-sm text-slate-300 max-w-3xl">
              Capture physical boundary evidence (GPS corner walks, satellite traces, or SURCON surveyor
              plans), link building footprints to parent plots, dispatch 100 m geofenced field
              inspectors, check LASRERA/NIESV agent credentials, benchmark prices per m², and audit
              every event in a tamper-evident SHA-256 hash chain.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {(user?.role === 'owner' || user?.role === 'agent' || user?.role === 'admin') && (
              <>
                <Link
                  to="/plots/new"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-sm transition"
                >
                  <Plus className="h-4 w-4" />
                  Capture Plot
                </Link>
                <Link
                  to="/buildings/new"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-sm transition"
                >
                  <Plus className="h-4 w-4" />
                  Record Building
                </Link>
              </>
            )}
            <Link
              to="/buildings"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-medium border border-slate-700 transition"
            >
              Built Houses ({buildings.length})
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Mandatory Disclaimer */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-300">
          <span>⚠️ {MEASUREMENT_DISCLAIMER}</span>
          <span className="text-slate-400">
            NDPA 2023 Compliant · Occupied homes fuzzed by ~300 m publicly
          </span>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Registered Plots
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <Compass className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900">{plots.length}</div>
          <p className="mt-1 text-xs text-slate-600">
            Geodesic WGS84 polygons with ±vertex uncertainty buffers
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Possible Overlaps / Duplicates
            </span>
            <div
              className={`p-2 rounded-lg ${
                openSpatialFlagsCount > 0
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              <ShieldAlert className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900">{openSpatialFlagsCount}</div>
          <p className="mt-1 text-xs text-slate-600">
            Flagged via STRtree spatial index (≥10% overlap or ≤30m centroid)
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Document Queue &amp; Vault
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700">
              <FileCheck2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900">
            {pendingDocReviewsCount} Pending
          </div>
          <p className="mt-1 text-xs text-slate-600">
            {externallyVerifiedDocsCount} items with confirmed external report
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Audit Hash Chain Status
            </span>
            <div
              className={`p-2 rounded-lg ${
                auditVerification.valid
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-rose-50 text-rose-700'
              }`}
            >
              <Link2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span
              className={`text-lg font-bold ${
                auditVerification.valid ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {auditVerification.valid ? 'Chain Intact' : 'Tamper Mismatch!'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            {auditEvents.length} append-only events · {totalGeofencedPhotos} geofenced photos
          </p>
        </div>
      </div>

      {/* Phase 3 Trust Layer Quick Access Cards (D1, D2, D4) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/inspections"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-400 transition flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase text-emerald-700">
              D1. Field Inspections (≤100 m Geofence)
            </span>
            <p className="text-sm font-bold text-slate-900">
              {inspections.length} Jobs ({inspections.filter((i) => i.status === 'completed').length}{' '}
              Immutable Reports)
            </p>
            <p className="text-xs text-slate-500">
              Diaspora/remote buyer inspection requests &amp; 11-point site reports
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
        </Link>

        <Link
          to="/agents"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-400 transition flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase text-indigo-700">
              D2. Agent Regulatory Register
            </span>
            <p className="text-sm font-bold text-slate-900">
              {agentProfiles.filter((a) => a.outcome === 'checked_ok').length} Checked ·{' '}
              {agentProfiles.filter((a) => a.outcome === 'pending').length} Pending
            </p>
            <p className="text-xs text-slate-500">
              LASRERA / NIESV / ESVARBON manual admin register checks
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
        </Link>

        <Link
          to="/documents"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-400 transition flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase text-amber-700">
              D4. Proof-of-Payment Receipt Trail
            </span>
            <p className="text-sm font-bold text-slate-900">
              {paymentReceipts.length} Stage Receipts Logged
            </p>
            <p className="text-xs text-slate-500">
              Dual-party buyer &amp; seller confirmation or dispute ledger
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
        </Link>
      </div>

      {/* Recent Plot Evidence Registry Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Recent Land Evidence Records (Nigeria)
            </h2>
            <p className="text-xs text-slate-500">
              Showing geodesic area ranges, boundary capture method, and itemised evidence status (no
              blanket &ldquo;verified&rdquo; badge).
            </p>
          </div>
          <Link
            to="/plots"
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
          >
            View All Plots <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                <th className="py-3 px-4">Plot &amp; Location</th>
                <th className="py-3 px-4">Boundary Method</th>
                <th className="py-3 px-4">Geodesic Area &amp; Uncertainty</th>
                <th className="py-3 px-4">Asking Price</th>
                <th className="py-3 px-4">Evidence Signals</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {plots.map((plot) => {
                const methodBadge = MEASUREMENT_METHOD_CONFIG[plot.measurement_method];
                const inAppPhotos = plot.photos.filter(
                  (ph) => ph.capture_source === 'captured_in_app' && ph.within_geofence
                ).length;
                const openFlags = plot.spatial_flags.filter((f) => f.status === 'open');

                return (
                  <tr key={plot.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4">
                      <Link
                        to={`/plots/${plot.id}`}
                        className="font-semibold text-slate-900 hover:text-emerald-700 block"
                      >
                        {plot.title}
                      </Link>
                      <span className="text-slate-500 text-[11px]">
                        {plot.area_name}, {plot.lga}, {plot.state} · Purpose:{' '}
                        <span className="capitalize font-medium">{plot.purpose}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium border ${methodBadge.badgeColor}`}
                      >
                        {methodBadge.label}
                      </span>
                      <span className="block text-[10px] text-slate-400 mt-0.5">
                        ±{plot.mean_vertex_accuracy_m.toFixed(1)}m mean accuracy
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 block">
                        {plot.computed_area_m2.toLocaleString()} m² ({plot.computed_area_plots.toFixed(2)}{' '}
                        plots)
                      </span>
                      <span className="text-[11px] text-emerald-800 font-medium">
                        Range: {plot.area_low_m2.toLocaleString()} – {plot.area_high_m2.toLocaleString()}{' '}
                        m²
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {formatPrice(plot.asking_price, plot.currency)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                            inAppPhotos >= 4
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          <Camera className="h-3 w-3" />
                          {inAppPhotos}/4 in-app
                        </span>

                        {openFlags.length > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[11px] font-semibold">
                            <AlertTriangle className="h-3 w-3" />
                            {openFlags[0].flag_type === 'possible_overlap'
                              ? 'Possible Overlap'
                              : 'Possible Duplicate'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            No Overlap
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        to={`/plots/${plot.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-emerald-700 text-white text-xs font-medium transition"
                      >
                        Inspect Evidence
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
