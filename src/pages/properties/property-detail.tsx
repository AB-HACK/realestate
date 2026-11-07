import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDataStore } from '../../stores/data-store';
import { useAuthStore } from '../../stores/auth-store';
import { useCurrencyStore } from '../../stores/currency-store';
import { InteractivePlotMap } from '../../components/evidence/interactive-plot-map';
import { EvidenceCompletenessPanel } from '../../components/evidence/evidence-completeness-panel';
import { InAppCamera } from '../../components/evidence/in-app-camera';
import { PriceBenchmarkCard } from '../../components/evidence/price-benchmark-card';
import {
  MEASUREMENT_DISCLAIMER,
  EVIDENCE_STATUS_CONFIG,
  DOCUMENT_TYPE_LABELS,
} from '../../lib/nigeria-data';
import { fuzzOccupiedLocation } from '../../lib/geodesic';
import { EvidenceStatus } from '../../types';
import {
  ArrowLeft,
  MapPin,
  ShieldAlert,
  Camera,
  FileText,
  Lock,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';

export const PropertyDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const {
    plots,
    addEvidencePhoto,
    uploadPlotDocument,
    adminUpdateDocumentStatus,
  } = useDataStore();
  const { user } = useAuthStore();
  const { formatPrice } = useCurrencyStore();

  const plot = plots.find((p) => p.id === id);

  const [docUploadNotes, setDocUploadNotes] = useState<Record<string, string>>({});
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [externalReportRef, setExternalReportRef] = useState<Record<string, string>>({});
  const [statusError, setStatusError] = useState<string | null>(null);
  const [signedVaultPreview, setSignedVaultPreview] = useState<{
    title: string;
    tokenUrl: string;
    expiresAt: string;
  } | null>(null);

  if (!plot) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-base font-semibold text-slate-800">Plot evidence record not found.</p>
        <Link to="/plots" className="text-sm text-emerald-700 underline">
          Return to Land Evidence Registry
        </Link>
      </div>
    );
  }

  const isOwnerOrAgent =
    user?.id === plot.owner_id || user?.role === 'owner' || user?.role === 'agent';
  const isAdmin = user?.role === 'admin';

  // NDPA 2023 rule: only approximate (~300m fuzzed) location shown publicly for occupied homes
  const showFuzzedLocation =
    plot.is_occupied_home && !isAdmin && user?.id !== plot.owner_id && user?.role !== 'inspector';

  const centerLat =
    plot.vertices.reduce((s, v) => s + v.lat, 0) / Math.max(1, plot.vertices.length);
  const centerLon =
    plot.vertices.reduce((s, v) => s + v.lon, 0) / Math.max(1, plot.vertices.length);

  const fuzzedCoords = showFuzzedLocation
    ? fuzzOccupiedLocation(centerLat, centerLon, plot.id, 300)
    : null;

  // If Admin and there is an open spatial conflict, find the conflicting plot to show side-by-side on map
  const openConflict = plot.spatial_flags.find((f) => f.status === 'open');
  const conflictingPlot =
    isAdmin && openConflict
      ? plots.find((p) => p.id === openConflict.conflicting_plot_id)
      : undefined;

  const handleOwnerUploadDoc = (docId: string, fileName: string) => {
    setStatusError(null);
    uploadPlotDocument(
      plot.id,
      docId,
      fileName,
      docUploadNotes[docId] || 'Uploaded to private vault for admin review.',
      user?.id || plot.owner_id
    );
  };

  const handleAdminStatusChange = (docId: string, nextStatus: EvidenceStatus) => {
    setStatusError(null);
    try {
      adminUpdateDocumentStatus({
        plot_id: plot.id,
        doc_id: docId,
        new_status: nextStatus,
        admin_notes:
          adminNotes[docId] ||
          `Status updated to ${nextStatus} by admin ${user?.name || 'Admin'}.`,
        external_report_ref: externalReportRef[docId],
        actor_id: user?.id || 'usr-admin-1',
        actor_role: user?.role || 'visitor',
      });
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Status update rejected.');
    }
  };

  const openSignedDocumentAccess = (docTitle: string, docId: string) => {
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const randomSig = Array.from({ length: 24 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    setSignedVaultPreview({
      title: docTitle,
      tokenUrl: `/api/documents/${docId}/signed-download?expires=${encodeURIComponent(
        expires
      )}&sig=${randomSig}`,
      expiresAt: expires,
    });
  };

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/plots"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Plot Evidence Registry
        </Link>
        <span className="text-xs text-slate-400 font-mono">Plot ID: {plot.id}</span>
      </div>

      {/* Mandatory Disclaimer Banner */}
      <div className="rounded-xl bg-amber-50 border border-amber-300 px-4 py-3 flex items-center gap-2.5 text-xs text-amber-950 font-semibold">
        <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0" />
        <span>{MEASUREMENT_DISCLAIMER}</span>
      </div>

      {/* Hero Summary Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-slate-900 text-white text-xs font-semibold uppercase">
                For {plot.purpose}
              </span>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                {plot.area_name}, {plot.lga}, {plot.state} State
              </span>
              {plot.is_occupied_home && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 text-xs font-medium">
                  <Lock className="h-3 w-3" />
                  NDPA Occupied Home (~300m Public Fuzzing Active)
                </span>
              )}
            </div>

            <h1 className="text-2xl font-bold text-slate-900">{plot.title}</h1>
            <p className="text-sm text-slate-600 max-w-3xl">{plot.description}</p>
          </div>

          <div className="lg:text-right shrink-0 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <span className="text-xs text-slate-500 block">Asking Price</span>
            <span className="text-2xl font-extrabold text-emerald-700 block">
              {formatPrice(plot.asking_price, plot.currency)}
            </span>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Submitted by {plot.owner_name} ({plot.owner_role})
            </span>
          </div>
        </div>

        {/* Owner-facing Possible Overlap Banner (B5: never reveals other party's identity to non-admin) */}
        {plot.spatial_flags.some((f) => f.status === 'open') && (
          <div className="mt-4 p-3.5 rounded-xl bg-amber-50 border border-amber-300 flex items-start gap-2.5 text-xs text-amber-950">
            <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              {isAdmin ? (
                <span>
                  <strong>Admin Spatial Alert:</strong> This plot has an open{' '}
                  <strong>{openConflict?.flag_type.replace('_', ' ')}</strong> flag (
                  {openConflict?.overlap_pct}% buffered intersection, centroids{' '}
                  {openConflict?.centroid_distance_m}m apart) with plot{' '}
                  <code>{openConflict?.conflicting_plot_id}</code>. Both polygons are rendered side
                  by side on the map below.
                </span>
              ) : (
                <span>
                  <strong>Spatial Notice:</strong> This plot boundary{' '}
                  <strong>may overlap another listing, an admin will review</strong>. (Identity of
                  other listing is withheld pending human review).
                </span>
              )}
            </div>
          </div>
        )}

        {/* Unit Conversions & Uncertainty Grid (B1) */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4 border-t border-slate-100 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block">Geodesic Area (m²)</span>
            <span className="text-sm font-bold text-slate-900">
              {plot.computed_area_m2.toLocaleString()} m²
            </span>
          </div>
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <span className="text-emerald-800 block font-medium">Uncertainty Range</span>
            <span className="text-sm font-bold text-emerald-950">
              {plot.area_low_m2.toLocaleString()} – {plot.area_high_m2.toLocaleString()} m²
            </span>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block">Hectares (ha)</span>
            <span className="text-sm font-bold text-slate-900">
              {plot.computed_area_hectares.toFixed(4)} ha
            </span>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block">Acres (ac)</span>
            <span className="text-sm font-bold text-slate-900">
              {plot.computed_area_acres.toFixed(4)} ac
            </span>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block">
              Plots (@ {plot.sqm_per_plot} m²/plot)
            </span>
            <span className="text-sm font-bold text-slate-900">
              {plot.computed_area_plots.toFixed(2)} plots
            </span>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block">Geodesic Perimeter</span>
            <span className="text-sm font-bold text-slate-900">
              {plot.computed_perimeter_m.toLocaleString()} m (±{plot.mean_vertex_accuracy_m}m)
            </span>
          </div>
        </div>
      </div>

      {/* Two-Column Layout: Map + Public Evidence Completeness Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-4">
          <InteractivePlotMap
            vertices={plot.vertices}
            comparisonVertices={conflictingPlot?.vertices}
            comparisonTitle={conflictingPlot?.title}
            fuzzedCenter={
              fuzzedCoords
                ? {
                    lat: fuzzedCoords.fuzzed_lat,
                    lon: fuzzedCoords.fuzzed_lon,
                    radiusM: fuzzedCoords.radius_m,
                  }
                : null
            }
            photoPoints={plot.photos.map((ph) => ({
              id: ph.id,
              lat: ph.lat,
              lon: ph.lon,
              withinGeofence: ph.within_geofence,
            }))}
          />

          {/* Corner Vertex Coordinates Table */}
          {!showFuzzedLocation && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Recorded Boundary Vertices (WGS84) &amp; GNSS Sampling Accuracy
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-1.5 pr-3">Corner</th>
                      <th className="py-1.5 pr-3">Latitude (°N)</th>
                      <th className="py-1.5 pr-3">Longitude (°E)</th>
                      <th className="py-1.5 pr-3">Mean Accuracy</th>
                      <th className="py-1.5">Samples Kept (≤15m)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {plot.vertices.map((v, idx) => (
                      <tr key={idx}>
                        <td className="py-1.5 pr-3 font-sans font-semibold text-slate-800">
                          Corner C{idx + 1}
                        </td>
                        <td className="py-1.5 pr-3">{v.lat.toFixed(6)}</td>
                        <td className="py-1.5 pr-3">{v.lon.toFixed(6)}</td>
                        <td className="py-1.5 pr-3 text-emerald-700 font-semibold">
                          ±{v.accuracy_m.toFixed(1)} m
                        </td>
                        <td className="py-1.5">{v.sample_count || 1} samples</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* B9: Public Evidence Completeness Panel */}
        <div className="lg:col-span-5">
          <EvidenceCompletenessPanel plot={plot} />
        </div>
      </div>

      {/* D3 & D6: Price Benchmarking (P5-P95 Band) & Suspicious Listing Report */}
      <PriceBenchmarkCard
        targetType="plot"
        targetId={plot.id}
        targetTitle={plot.title}
      />

      {/* B6: Geotagged Photo Evidence Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Camera className="h-5 w-5 text-emerald-600" />
              B6. Geotagged Site Photo Evidence ({plot.photos.length} attached)
            </h2>
            <p className="text-xs text-slate-600">
              Each photo stores client &amp; authoritative server timestamps, GPS coordinates,
              distance to polygon, SHA-256 hash, and 64-bit perceptual hash (pHash).
            </p>
          </div>
        </div>

        {/* Photo Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plot.photos.map((photo, index) => (
            <div
              key={photo.id}
              className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50 flex flex-col justify-between"
            >
              <div className="relative h-40 bg-slate-900">
                <img
                  src={photo.preview_url}
                  alt={photo.caption}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      photo.capture_source === 'captured_in_app'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-200'
                    }`}
                  >
                    {photo.capture_source === 'captured_in_app'
                      ? 'Captured In-App'
                      : 'Uploaded'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      photo.within_geofence
                        ? 'bg-sky-600 text-white'
                        : 'bg-amber-500 text-slate-950'
                    }`}
                  >
                    {photo.distance_to_polygon_m}m from plot
                  </span>
                </div>
                {photo.reused_across_listings && (
                  <div className="absolute bottom-0 inset-x-0 bg-rose-600 text-white text-[10px] font-bold px-2 py-1">
                    ⚠️ Flagged: Image Hash Reused on Another Listing
                  </div>
                )}
              </div>

              <div className="p-3 space-y-1 text-[11px]">
                <p className="font-semibold text-slate-900">
                  P{index + 1}: {photo.caption}
                </p>
                <p className="text-slate-500">
                  GPS: {photo.lat.toFixed(5)}°N, {photo.lon.toFixed(5)}°E (±
                  {photo.gps_accuracy_m}m)
                </p>
                <p className="text-slate-500">
                  Server Time: {new Date(photo.server_received_at).toLocaleString()}
                </p>
                <p className="text-[10px] font-mono text-slate-400 truncate">
                  SHA256: {photo.sha256_hash.slice(0, 20)}... · pHash: {photo.perceptual_hash}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* In-App Capture Widget for Owner / Agent / Inspector / Admin */}
        {(isOwnerOrAgent || isAdmin || user?.role === 'inspector') && (
          <InAppCamera
            plotCenterLat={centerLat}
            plotCenterLon={centerLon}
            onCapturePhoto={(payload) => {
              addEvidencePhoto({
                plot_id: plot.id,
                actor_id: user?.id || plot.owner_id,
                ...payload,
              });
            }}
          />
        )}
      </div>

      {/* B7: Document Checklist & Private Signed Access Vault */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-600" />
              B7. Document Checklist &amp; Private Vault Workflow
            </h2>
            <p className="text-xs text-slate-600">
              Allowed statuses: <code>not_provided</code>, <code>uploaded</code>,{' '}
              <code>under_review</code>, <code>reviewed_by_admin</code>,{' '}
              <code>externally_verified</code> (requires external registry/solicitor report ref).
              Owners cannot promote their own statuses.
            </p>
          </div>
        </div>

        {statusError && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 font-medium">
            {statusError}
          </div>
        )}

        {signedVaultPreview && (
          <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-950 flex flex-wrap items-center justify-between gap-2">
            <div>
              <strong>Signed Private Vault Token Generated for {signedVaultPreview.title}:</strong>
              <code className="block mt-1 text-[11px] bg-white px-2 py-1 rounded border border-indigo-200 font-mono">
                {signedVaultPreview.tokenUrl}
              </code>
              <span className="text-[10px] text-indigo-700">
                Expires at: {new Date(signedVaultPreview.expiresAt).toLocaleTimeString()} (Never
                served via public URL)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSignedVaultPreview(null)}
              className="px-2.5 py-1 rounded bg-indigo-900 text-white text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="divide-y divide-slate-200">
          {plot.documents.map((doc) => {
            const statusInfo = EVIDENCE_STATUS_CONFIG[doc.status];
            return (
              <div key={doc.id} className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">
                      {DOCUMENT_TYPE_LABELS[doc.doc_type] || doc.title}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-xs font-semibold ${statusInfo.badgeClass}`}
                    >
                      {statusInfo.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{statusInfo.description}</p>
                  {doc.file_name && (
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700 pt-1">
                      <span>
                        Vault File: <strong>{doc.file_name}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => openSignedDocumentAccess(doc.title, doc.id)}
                        className="inline-flex items-center gap-1 text-indigo-700 hover:underline font-medium"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Generate Signed Vault Access Token
                      </button>
                    </div>
                  )}
                  {doc.admin_notes && (
                    <p className="text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200 mt-1">
                      <strong>Review Note:</strong> {doc.admin_notes}
                    </p>
                  )}
                  {doc.external_report_ref && (
                    <p className="text-xs text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 mt-1 inline-block">
                      <CheckCircle2 className="h-3 w-3 inline mr-1" />
                      External Report Reference: <strong>{doc.external_report_ref}</strong>
                    </p>
                  )}
                </div>

                {/* Owner Upload Control vs Admin Review Promotion Control */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                  {isOwnerOrAgent && !isAdmin && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Document note..."
                        value={docUploadNotes[doc.id] || ''}
                        onChange={(e) =>
                          setDocUploadNotes((prev) => ({ ...prev, [doc.id]: e.target.value }))
                        }
                        className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                      />
                      <label className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium cursor-pointer">
                        <Upload className="h-3.5 w-3.5" />
                        <span>Upload to Vault</span>
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleOwnerUploadDoc(doc.id, f.name);
                          }}
                        />
                      </label>
                    </div>
                  )}

                  {isAdmin && (
                    <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <input
                        type="text"
                        placeholder="Admin review note..."
                        value={adminNotes[doc.id] || ''}
                        onChange={(e) =>
                          setAdminNotes((prev) => ({ ...prev, [doc.id]: e.target.value }))
                        }
                        className="rounded border border-slate-300 px-2 py-1 text-xs bg-white"
                      />
                      <input
                        type="text"
                        placeholder="External report ref (for Externally Verified)"
                        value={externalReportRef[doc.id] || doc.external_report_ref || ''}
                        onChange={(e) =>
                          setExternalReportRef((prev) => ({ ...prev, [doc.id]: e.target.value }))
                        }
                        className="rounded border border-slate-300 px-2 py-1 text-xs bg-white w-56"
                      />
                      <select
                        value={doc.status}
                        onChange={(e) =>
                          handleAdminStatusChange(doc.id, e.target.value as EvidenceStatus)
                        }
                        className="rounded border border-indigo-300 bg-indigo-50 text-indigo-950 px-2 py-1 text-xs font-semibold"
                      >
                        <option value="not_provided">Not Provided</option>
                        <option value="uploaded">Uploaded</option>
                        <option value="under_review">Under Review</option>
                        <option value="reviewed_by_admin">Reviewed by Admin</option>
                        <option value="externally_verified">Externally Verified</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
