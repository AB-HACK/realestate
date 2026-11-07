import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDataStore } from '../../stores/data-store';
import { useAuthStore } from '../../stores/auth-store';
import { InteractivePlotMap } from '../../components/evidence/interactive-plot-map';
import { EVIDENCE_STATUS_CONFIG, DOCUMENT_TYPE_LABELS } from '../../lib/nigeria-data';
import { EvidenceStatus } from '../../types';
import {
  ShieldAlert,
  FileCheck2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';

export const AdminReview: React.FC = () => {
  const {
    plots,
    buildings,
    inspections,
    agentProfiles,
    paymentReceipts,
    suspiciousReports,
    auditEvents,
    auditVerification,
    adminResolveFlag,
    adminUpdateDocumentStatus,
    resolveConflictingListingClaim,
    adminReviewSuspiciousReport,
  } = useDataStore();
  const { user, switchRole } = useAuthStore();

  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [docNotes, setDocNotes] = useState<Record<string, string>>({});
  const [extRef, setExtRef] = useState<Record<string, string>>({});
  const [reportNotes, setReportNotes] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Collect all spatial flags across plots
  const allConflicts = plots.flatMap((plot) =>
    plot.spatial_flags.map((flag) => ({
      plot,
      flag,
      conflictingPlot: plots.find((p) => p.id === flag.conflicting_plot_id),
    }))
  );

  // Collect all uploaded / under_review documents across plots
  const reviewableDocs = plots.flatMap((plot) =>
    plot.documents
      .filter((d) => d.status !== 'not_provided')
      .map((doc) => ({ plot, doc }))
  );

  if (user?.role !== 'admin') {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 space-y-3">
        <div className="flex items-center gap-2 text-amber-900 font-bold text-base">
          <ShieldAlert className="h-5 w-5 text-amber-700" />
          Admin Role Required for Conflict &amp; Document Review Queue
        </div>
        <p className="text-xs text-amber-800">
          You are currently signed in as <strong>{user?.name}</strong> ({user?.role}). In accordance
          with Part A &amp; B5/B7 rules, only an Admin can inspect both conflicting plot identities
          side by side or promote document statuses.
        </p>
        <button
          type="button"
          onClick={() => switchRole('admin')}
          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
        >
          Switch to Admin Role (Amina Yusuf — Admin)
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          D5. Unified Admin Trust Dashboard &amp; Review Queues (B5, B7, C5, D1–D6)
        </h1>
        <p className="text-sm text-slate-600">
          Inspect buffered polygon overlaps and centroid duplicates side by side on the map, review
          private vault documents, manage agent register checks, field inspections, disputed payment
          receipts, and suspicious listing reports. Conflicts are worded &ldquo;possible
          overlap&rdquo; or &ldquo;possible duplicate&rdquo;, never &ldquo;fraud&rdquo;.
        </p>
      </div>

      {/* D5: Unified Admin Trust Metrics Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-sm">
          <span className="text-slate-500 block">Open Spatial Flags</span>
          <span className="text-xl font-extrabold text-amber-700 block mt-0.5">
            {allConflicts.filter((c) => c.flag.status === 'open').length}
          </span>
          <span className="text-[11px] text-slate-400">B5 Polygon Queue</span>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-sm">
          <span className="text-slate-500 block">Document Queue</span>
          <span className="text-xl font-extrabold text-indigo-700 block mt-0.5">
            {
              reviewableDocs.filter(
                (d) => d.doc.status === 'uploaded' || d.doc.status === 'under_review'
              ).length
            }
          </span>
          <span className="text-[11px] text-slate-400">B7 Private Vault</span>
        </div>

        <Link
          to="/agents"
          className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-sm hover:border-emerald-400 transition block"
        >
          <span className="text-slate-500 block">Pending Agents</span>
          <span className="text-xl font-extrabold text-emerald-700 block mt-0.5">
            {agentProfiles.filter((a) => a.outcome === 'pending').length}
          </span>
          <span className="text-[11px] text-emerald-700 underline">D2 Register Queue &rarr;</span>
        </Link>

        <Link
          to="/inspections"
          className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-sm hover:border-emerald-400 transition block"
        >
          <span className="text-slate-500 block">Unassigned Inspections</span>
          <span className="text-xl font-extrabold text-sky-700 block mt-0.5">
            {inspections.filter((i) => i.status === 'requested').length}
          </span>
          <span className="text-[11px] text-sky-700 underline">D1 Assign Inspector &rarr;</span>
        </Link>

        <Link
          to="/documents"
          className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-sm hover:border-emerald-400 transition block"
        >
          <span className="text-slate-500 block">Disputed Receipts</span>
          <span className="text-xl font-extrabold text-rose-700 block mt-0.5">
            {
              paymentReceipts.filter(
                (r) => r.buyer_status === 'disputed' || r.seller_status === 'disputed'
              ).length
            }
          </span>
          <span className="text-[11px] text-rose-700 underline">D4 Payment Trail &rarr;</span>
        </Link>

        <Link
          to="/admin/audit"
          className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-sm hover:border-emerald-400 transition block"
        >
          <span className="text-slate-500 block">Audit Chain ({auditEvents.length})</span>
          <span
            className={`text-base font-extrabold block mt-0.5 ${
              auditVerification.valid ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {auditVerification.valid ? 'VALID (Intact)' : 'MISMATCH!'}
          </span>
          <span className="text-[11px] text-slate-500 underline">B8 Hash Chain &rarr;</span>
        </Link>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 font-medium">
          {errorMsg}
        </div>
      )}

      {/* B5: Spatial Conflict Side-by-Side Inspection */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              B5. Spatial Overlap &amp; Duplicate Comparison Queue ({allConflicts.length})
            </h2>
            <p className="text-xs text-slate-500">
              Flagged when buffered polygons intersect by ≥10% of the smaller polygon, or when
              centroids are within 30 m and areas within 10%.
            </p>
          </div>
        </div>

        {allConflicts.length === 0 ? (
          <p className="text-xs text-slate-500">No spatial conflict flags recorded.</p>
        ) : (
          <div className="space-y-6">
            {allConflicts.map(({ plot, flag, conflictingPlot }) => (
              <div
                key={flag.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                        flag.status === 'open'
                          ? 'bg-rose-100 text-rose-900 border border-rose-300'
                          : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      }`}
                    >
                      {flag.flag_type.replace('_', ' ')} ({flag.status})
                    </span>
                    <span className="text-xs text-slate-600">
                      Intersection: <strong>{flag.overlap_pct}%</strong> · Centroid Distance:{' '}
                      <strong>{flag.centroid_distance_m} m</strong> · Area Diff:{' '}
                      <strong>{flag.area_diff_pct}%</strong>
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Flagged {new Date(flag.created_at).toLocaleString()}
                  </span>
                </div>

                {/* Side-by-Side Party Comparison Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 rounded-lg bg-white border border-emerald-300">
                    <span className="text-[10px] font-bold uppercase text-emerald-700">
                      Primary Listing (Green Polygon)
                    </span>
                    <Link
                      to={`/plots/${plot.id}`}
                      className="font-bold text-slate-900 hover:underline block mt-0.5"
                    >
                      {plot.title}
                    </Link>
                    <p className="text-slate-600 mt-0.5">
                      Submitter: <strong>{plot.owner_name}</strong> ({plot.owner_role}) · Area:{' '}
                      <strong>{plot.computed_area_m2} m²</strong> (
                      {plot.measurement_method.replace('_', ' ')})
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-white border border-rose-300">
                    <span className="text-[10px] font-bold uppercase text-rose-700">
                      Conflicting Listing (Red Dashed Polygon)
                    </span>
                    {conflictingPlot ? (
                      <>
                        <Link
                          to={`/plots/${conflictingPlot.id}`}
                          className="font-bold text-slate-900 hover:underline block mt-0.5"
                        >
                          {conflictingPlot.title}
                        </Link>
                        <p className="text-slate-600 mt-0.5">
                          Submitter: <strong>{conflictingPlot.owner_name}</strong> (
                          {conflictingPlot.owner_role}) · Area:{' '}
                          <strong>{conflictingPlot.computed_area_m2} m²</strong> (
                          {conflictingPlot.measurement_method.replace('_', ' ')})
                        </p>
                      </>
                    ) : (
                      <p className="text-slate-500">Plot ID: {flag.conflicting_plot_id}</p>
                    )}
                  </div>
                </div>

                {/* Side-by-Side Polygon Map */}
                <InteractivePlotMap
                  vertices={plot.vertices}
                  comparisonVertices={conflictingPlot?.vertices}
                  comparisonTitle={conflictingPlot?.title}
                  heightClass="h-72"
                />

                {/* Admin Resolution Controls */}
                {flag.status === 'open' ? (
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <input
                      type="text"
                      value={resolutionNotes[flag.id] || ''}
                      onChange={(e) =>
                        setResolutionNotes((prev) => ({ ...prev, [flag.id]: e.target.value }))
                      }
                      placeholder="Enter admin review notes (e.g., Survey beacon check requested from both parties)..."
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        adminResolveFlag(
                          plot.id,
                          flag.id,
                          'resolved_confirmed_conflict',
                          resolutionNotes[flag.id] ||
                            'Confirmed spatial overlap; both listings annotated in audit chain.',
                          user.id
                        )
                      }
                      className="px-3.5 py-2 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold"
                    >
                      Mark Confirmed Overlap / Duplicate
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        adminResolveFlag(
                          plot.id,
                          flag.id,
                          'resolved_benign',
                          resolutionNotes[flag.id] ||
                            'Reviewed survey plans; adjacent plots sharing boundary beacon only.',
                          user.id
                        )
                      }
                      className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
                    >
                      Resolve as Adjacent / Benign
                    </button>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 inline mr-1.5" />
                    <strong>Admin Resolution:</strong> {flag.admin_notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* B7: Admin Document Review Queue */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-indigo-600" />
            B7. Document Review Queue ({reviewableDocs.length} items)
          </h2>
          <p className="text-xs text-slate-500">
            Promote documents through <code>under_review</code>, <code>reviewed_by_admin</code>, or{' '}
            <code>externally_verified</code> (only when an external registry search or
            solicitor/surveyor report reference is attached).
          </p>
        </div>

        <div className="divide-y divide-slate-200">
          {reviewableDocs.map(({ plot, doc }) => {
            const statusCfg = EVIDENCE_STATUS_CONFIG[doc.status];
            return (
              <div
                key={doc.id}
                className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">
                      {DOCUMENT_TYPE_LABELS[doc.doc_type] || doc.title}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded font-semibold ${statusCfg.badgeClass}`}
                    >
                      {statusCfg.label}
                    </span>
                    <Link
                      to={`/plots/${plot.id}`}
                      className="text-emerald-700 hover:underline inline-flex items-center gap-1 font-medium"
                    >
                      {plot.title} <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                  <p className="text-slate-600">
                    File: <strong>{doc.file_name || 'Attached'}</strong> · Notes:{' '}
                    {doc.admin_notes || 'None'}
                  </p>
                  {doc.external_report_ref && (
                    <p className="text-emerald-800 font-medium">
                      External Report Ref: {doc.external_report_ref}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    placeholder="Review note..."
                    value={docNotes[doc.id] || ''}
                    onChange={(e) =>
                      setDocNotes((prev) => ({ ...prev, [doc.id]: e.target.value }))
                    }
                    className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="External report ref (required for Externally Verified)"
                    value={extRef[doc.id] || doc.external_report_ref || ''}
                    onChange={(e) =>
                      setExtRef((prev) => ({ ...prev, [doc.id]: e.target.value }))
                    }
                    className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs w-60"
                  />
                  <select
                    value={doc.status}
                    onChange={(e) => {
                      setErrorMsg(null);
                      try {
                        adminUpdateDocumentStatus({
                          plot_id: plot.id,
                          doc_id: doc.id,
                          new_status: e.target.value as EvidenceStatus,
                          admin_notes:
                            docNotes[doc.id] ||
                            `Reviewed by Admin (${user.name}) on ${new Date().toLocaleDateString()}`,
                          external_report_ref: extRef[doc.id] || doc.external_report_ref,
                          actor_id: user.id,
                          actor_role: user.role,
                        });
                      } catch (err) {
                        setErrorMsg(err instanceof Error ? err.message : 'Update failed.');
                      }
                    }}
                    className="rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-950 px-2.5 py-1.5 font-semibold"
                  >
                    <option value="uploaded">Uploaded</option>
                    <option value="under_review">Under Review</option>
                    <option value="reviewed_by_admin">Reviewed by Admin</option>
                    <option value="externally_verified">Externally Verified</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* C5: Blocked Duplicate Unit Listing Claims (One-Active-Listing Rule) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-600" />
            C5. Blocked Conflicting Unit Listing Claims (One-Active-Listing Rule)
          </h2>
          <p className="text-xs text-slate-500">
            Attempts to list a property unit that already has an active primary listing without
            explicit owner authorization are automatically blocked and routed here.
          </p>
        </div>

        <div className="space-y-3">
          {buildings
            .flatMap((b) =>
              b.units.flatMap((u) =>
                u.conflicting_claims.map((c) => ({ bld: b, unit: u, claim: c }))
              )
            )
            .map(({ bld, unit, claim }) => (
              <div
                key={claim.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded font-bold uppercase ${
                        claim.status === 'open'
                          ? 'bg-rose-100 text-rose-900'
                          : 'bg-emerald-100 text-emerald-900'
                      }`}
                    >
                      {claim.status}
                    </span>
                    <Link
                      to={`/buildings/${bld.id}`}
                      className="font-bold text-slate-900 hover:underline"
                    >
                      {bld.title} — {unit.unit_name}
                    </Link>
                  </div>
                  <p className="text-slate-600">{claim.reason}</p>
                  <p className="text-slate-500">
                    Attempted by: <strong>{claim.claimant_name}</strong> ({claim.claimant_role}) ·
                    Existing Listing ID: <code>{claim.existing_listing_id}</code>
                  </p>
                </div>

                {claim.status === 'open' && (
                  <button
                    type="button"
                    onClick={() =>
                      resolveConflictingListingClaim(
                        bld.id,
                        unit.id,
                        claim.id,
                        'Reviewed by Admin; unauthorized duplicate listing remained blocked.',
                        user.id
                      )
                    }
                    className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold shrink-0"
                  >
                    Mark Claim Reviewed &amp; Closed
                  </button>
                )}
              </div>
            ))}
        </div>
      </div>

      {/* D6: Suspicious Listing Reports Queue */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-rose-600" />
            D6. Suspicious Listing Reports Queue ({suspiciousReports.length})
          </h2>
          <p className="text-xs text-slate-500">
            User-submitted suspicious listing reports (possible duplicate, price anomaly, boundary
            concern, or unauthorized agent claim) routed to Admin review and logged in the SHA-256
            audit chain.
          </p>
        </div>

        <div className="space-y-3">
          {suspiciousReports.map((rep) => (
            <div
              key={rep.id}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded font-bold uppercase ${
                      rep.status === 'open'
                        ? 'bg-rose-100 text-rose-900 border border-rose-300'
                        : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    }`}
                  >
                    {rep.status}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-semibold">
                    Category: {rep.reason_category.replace(/_/g, ' ')}
                  </span>
                  <Link
                    to={
                      rep.target_type === 'plot'
                        ? `/plots/${rep.target_id}`
                        : `/buildings/${rep.target_id}`
                    }
                    className="font-bold text-slate-900 hover:underline inline-flex items-center gap-1"
                  >
                    {rep.target_title} <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
                <p className="text-slate-700">{rep.description}</p>
                <p className="text-[11px] text-slate-500">
                  Reported by <strong>{rep.reporter_name}</strong> ({rep.reporter_role}) on{' '}
                  {new Date(rep.created_at).toLocaleString()}
                </p>
                {rep.admin_notes && (
                  <p className="text-[11px] text-emerald-800 font-semibold">
                    Admin Resolution: {rep.admin_notes}
                  </p>
                )}
              </div>

              {rep.status === 'open' && (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <input
                    type="text"
                    placeholder="Admin review note..."
                    value={reportNotes[rep.id] || ''}
                    onChange={(e) =>
                      setReportNotes((prev) => ({ ...prev, [rep.id]: e.target.value }))
                    }
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      adminReviewSuspiciousReport({
                        report_id: rep.id,
                        status: 'reviewed_by_admin',
                        admin_notes:
                          reportNotes[rep.id] ||
                          `Reviewed by Admin (${user.name}); listing flagged for follow-up evidence check.`,
                        actor_id: user.id,
                      })
                    }
                    className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                  >
                    Mark Reviewed
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      adminReviewSuspiciousReport({
                        report_id: rep.id,
                        status: 'dismissed',
                        admin_notes:
                          reportNotes[rep.id] ||
                          `Dismissed by Admin (${user.name}) after inspecting boundary/document evidence.`,
                        actor_id: user.id,
                      })
                    }
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

