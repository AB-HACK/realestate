import React from 'react';
import { PlotRecord } from '../../types';
import {
  EVIDENCE_STATUS_CONFIG,
  MEASUREMENT_METHOD_CONFIG,
  MEASUREMENT_DISCLAIMER,
  DOCUMENT_TYPE_LABELS,
} from '../../lib/nigeria-data';
import {
  Compass,
  Camera,
  FileCheck2,
  AlertTriangle,
  UserCheck,
  Info,
  CheckCircle2,
  Clock,
} from 'lucide-react';

interface EvidenceCompletenessPanelProps {
  plot: PlotRecord;
  compact?: boolean;
}

export const EvidenceCompletenessPanel: React.FC<EvidenceCompletenessPanelProps> = ({
  plot,
  compact = false,
}) => {
  const methodInfo = MEASUREMENT_METHOD_CONFIG[plot.measurement_method];
  const inAppGeofencedCount = plot.photos.filter(
    (p) => p.capture_source === 'captured_in_app' && p.within_geofence && !p.reused_across_listings
  ).length;
  const reusedPhotosCount = plot.photos.filter((p) => p.reused_across_listings).length;
  const openSpatialFlags = plot.spatial_flags.filter((f) => f.status === 'open');

  // Group documents by status
  const statusCounts = plot.documents.reduce(
    (acc, doc) => {
      acc[doc.status] = (acc[doc.status] || 0) + 1;
      return acc;
    },
    {
      not_provided: 0,
      uploaded: 0,
      under_review: 0,
      reviewed_by_admin: 0,
      externally_verified: 0,
    } as Record<string, number>
  );

  if (compact) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2 text-xs">
        <div className="flex items-center justify-between font-medium text-slate-800">
          <span>Evidence Completeness Breakdown</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] border ${methodInfo.badgeColor}`}>
            {methodInfo.label}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-slate-600">
          <div>
            <span className="text-slate-400 block text-[10px]">Geodesic Area Range</span>
            <span className="font-semibold text-slate-800">
              {plot.area_low_m2.toLocaleString()} – {plot.area_high_m2.toLocaleString()} m²
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">In-App Geofenced Photos</span>
            <span
              className={`font-semibold ${
                inAppGeofencedCount >= 4 ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {inAppGeofencedCount} / 4 required (≤50m)
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200">
          <span className="text-[11px] text-slate-500">Docs:</span>
          {statusCounts.externally_verified > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 font-medium text-[10px]">
              {statusCounts.externally_verified} Externally Verified
            </span>
          )}
          {statusCounts.reviewed_by_admin > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-medium text-[10px]">
              {statusCounts.reviewed_by_admin} Reviewed by Admin
            </span>
          )}
          {statusCounts.under_review + statusCounts.uploaded > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium text-[10px]">
              {statusCounts.under_review + statusCounts.uploaded} Pending Review
            </span>
          )}
          {openSpatialFlags.length > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-semibold text-[10px]">
              Possible Overlap / Duplicate Flagged
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold tracking-tight flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-emerald-400" />
            Public Evidence Completeness Panel
          </h3>
          <p className="text-xs text-slate-300 mt-0.5">
            Itemised physical & documentary signals. This platform never issues a blanket &ldquo;verified&rdquo; badge.
          </p>
        </div>
        <span className="text-[11px] bg-slate-800 text-emerald-300 border border-slate-700 px-2.5 py-1 rounded-md">
          Tamper-Evident Audit Logged
        </span>
      </div>

      <div className="p-5 space-y-5">
        {/* 1. Boundary Method & Geodesic Uncertainty */}
        <div className="flex items-start gap-3.5 pb-4 border-b border-slate-100">
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 mt-0.5">
            <Compass className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-slate-900">
                1. Boundary Measurement & Uncertainty Range
              </h4>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${methodInfo.badgeColor}`}
              >
                {methodInfo.label} ({methodInfo.confidenceNote})
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">{methodInfo.description}</p>
            <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block">Computed Geodesic Area</span>
                <span className="font-bold text-slate-900 text-sm">
                  {plot.computed_area_m2.toLocaleString()} m²
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Uncertainty Range</span>
                <span className="font-semibold text-emerald-800">
                  {plot.area_low_m2.toLocaleString()} – {plot.area_high_m2.toLocaleString()} m²
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Mean Corner Accuracy</span>
                <span className="font-semibold text-slate-900">
                  ±{plot.mean_vertex_accuracy_m.toFixed(1)} m ({plot.vertices.length} corners)
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">
                  Custom Plots ({plot.sqm_per_plot} m²/plot)
                </span>
                <span className="font-semibold text-slate-900">
                  {plot.computed_area_plots.toFixed(2)} plots ({plot.computed_area_acres.toFixed(3)} ac)
                </span>
              </div>
            </div>
            {plot.surveyor_discrepancy_flagged && (
              <div className="mt-2 flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>
                  Stated surveyor area ({plot.stated_surveyor_area_m2?.toLocaleString()} m²) differs from
                  measured geodesic area by{' '}
                  <strong>{plot.surveyor_discrepancy_pct?.toFixed(1)}%</strong> (&gt;15% threshold). Routed
                  for admin review.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 2. Geotagged In-App Photo Evidence */}
        <div className="flex items-start gap-3.5 pb-4 border-b border-slate-100">
          <div className="p-2 rounded-lg bg-sky-50 text-sky-700 mt-0.5">
            <Camera className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-slate-900">
                2. Physical Site Photo Evidence (≤50m Geofence)
              </h4>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                  inAppGeofencedCount >= 4
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-amber-50 text-amber-800 border-amber-300'
                }`}
              >
                {inAppGeofencedCount} / 4 In-App Geofenced Photos
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Total photos attached: <strong>{plot.photos.length}</strong> (
              {plot.photos.filter((p) => p.capture_source === 'captured_in_app').length} captured
              in-app, {plot.photos.filter((p) => p.capture_source === 'uploaded').length} uploaded from
              device).
            </p>
            {reusedPhotosCount > 0 && (
              <div className="mt-2 flex items-center gap-2 text-xs text-rose-800 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>
                  <strong>{reusedPhotosCount} photo(s) flagged</strong> for matching SHA-256 or perceptual
                  hash (pHash) on another listing.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 3. Document Checklist by Status */}
        <div className="flex items-start gap-3.5 pb-4 border-b border-slate-100">
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700 mt-0.5">
            <FileCheck2 className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-slate-900 mb-2">
              3. Document Checklist Statuses (Private Vault)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {plot.documents.map((doc) => {
                const statusInfo = EVIDENCE_STATUS_CONFIG[doc.status];
                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 text-xs"
                  >
                    <div className="pr-2">
                      <span className="font-medium text-slate-800 block">
                        {DOCUMENT_TYPE_LABELS[doc.doc_type] || doc.title}
                      </span>
                      {doc.external_report_ref && (
                        <span className="text-[10px] text-emerald-700 block">
                          Ref: {doc.external_report_ref}
                        </span>
                      )}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md font-medium whitespace-nowrap ${statusInfo.badgeClass}`}
                    >
                      {statusInfo.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 4. Spatial Overlap & Duplicate Check */}
        <div className="flex items-start gap-3.5 pb-4 border-b border-slate-100">
          <div
            className={`p-2 rounded-lg mt-0.5 ${
              openSpatialFlags.length > 0
                ? 'bg-amber-50 text-amber-700'
                : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-slate-900">
                4. Spatial Conflict & Duplicate Check (STRtree Index)
              </h4>
              {openSpatialFlags.length === 0 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  No Open Spatial Conflicts
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-900 border border-amber-300">
                  <Clock className="h-3.5 w-3.5" />
                  {openSpatialFlags.length} Possible Conflict(s) Under Admin Review
                </span>
              )}
            </div>
            {openSpatialFlags.length === 0 ? (
              <p className="text-xs text-slate-600 mt-1">
                Buffered polygon compared against all registered plots. No intersection ≥10% or centroid
                proximity ≤30m detected.
              </p>
            ) : (
              <div className="mt-2 space-y-1.5">
                {openSpatialFlags.map((flag) => (
                  <div
                    key={flag.id}
                    className="text-xs bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 rounded-lg"
                  >
                    <strong>
                      {flag.flag_type === 'possible_overlap'
                        ? 'Possible Overlap'
                        : 'Possible Duplicate'}{' '}
                      Detected:
                    </strong>{' '}
                    May overlap or duplicate another listing ({flag.overlap_pct.toFixed(1)}% buffered
                    intersection, centroids {flag.centroid_distance_m.toFixed(1)}m apart). An admin will
                    review.
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 5. Owner / Agent Registration Statement */}
        <div className="flex items-start gap-3.5">
          <div className="p-2 rounded-lg bg-slate-100 text-slate-700 mt-0.5">
            <UserCheck className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-slate-900">
              5. Submitter & Agent Registration Record
            </h4>
            <p className="text-xs text-slate-700 mt-1">
              Listed by <strong>{plot.owner_name}</strong> ({plot.owner_role}).
            </p>
            <p className="text-xs text-slate-600 mt-0.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md">
              {plot.agent_badge_text || 'Direct owner submission — no external agent intermediary.'}
            </p>
          </div>
        </div>

        {/* Mandatory Disclaimer Footer */}
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-2 text-xs text-amber-900 font-medium">
          <Info className="h-4 w-4 text-amber-700 shrink-0" />
          <span>{MEASUREMENT_DISCLAIMER}</span>
        </div>
      </div>
    </div>
  );
};

