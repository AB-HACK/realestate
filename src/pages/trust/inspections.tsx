import React, { useState } from 'react';
import {
  MapPin,
  ShieldCheck,
  AlertTriangle,
  Camera,
  CheckCircle2,
  Star,
  UserCheck,
  Globe2,
  Lock,
  Navigation,
} from 'lucide-react';
import { useDataStore } from '../../stores/data-store';
import { useAuthStore } from '../../stores/auth-store';
import { ConditionItem } from '../../types';
import { MEASUREMENT_DISCLAIMER } from '../../lib/nigeria-data';

export const InspectionsPage: React.FC = () => {
  const { user } = useAuthStore();
  const plots = useDataStore((s) => s.plots);
  const buildings = useDataStore((s) => s.buildings);
  const inspections = useDataStore((s) => s.inspections);
  const requestInspection = useDataStore((s) => s.requestInspection);
  const adminAssignInspector = useDataStore((s) => s.adminAssignInspector);
  const inspectorStartJob = useDataStore((s) => s.inspectorStartJob);
  const inspectorSubmitReport = useDataStore((s) => s.inspectorSubmitReport);
  const rateInspection = useDataStore((s) => s.rateInspection);

  const [targetType, setTargetType] = useState<'plot' | 'building'>('plot');
  const [targetId, setTargetId] = useState<string>(plots[0]?.id || 'plot-ibadan-001');
  const [isDiaspora, setIsDiaspora] = useState(true);
  const [requesterNote, setRequesterNote] = useState('');
  const [geofenceBanner, setGeofenceBanner] = useState<{
    jobId: string;
    ok: boolean;
    text: string;
  } | null>(null);

  const [reportSummaryMap, setReportSummaryMap] = useState<Record<string, string>>({});
  const [mediaCaptionMap, setMediaCaptionMap] = useState<Record<string, string>>({});
  const [mediaTypeMap, setMediaTypeMap] = useState<Record<string, 'photo' | 'video'>>({});
  const [ratingValMap, setRatingValMap] = useState<Record<string, number>>({});
  const [ratingCommentMap, setRatingCommentMap] = useState<Record<string, string>>({});

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId) return;
    requestInspection({
      target_type: targetType,
      target_id: targetId,
      requester_id: user?.id || 'usr-buyer-1',
      requester_name: user?.name || 'Funke Adeyemi (Buyer/Renter)',
      requester_role: user?.role || 'buyer_renter',
      is_diaspora_requester: isDiaspora,
      requester_note:
        requesterNote.trim() ||
        'Requesting independent on-site physical verification of beacons, utilities, and occupancy.',
    });
    setRequesterNote('');
  };

  const handleSimulateGeofenceStart = (
    jobId: string,
    targetLat: number,
    targetLon: number,
    simulateFarAway: boolean
  ) => {
    // 0.0031 deg latitude is ~344 m away (>100 m geofence); 0.00012 deg is ~13.3 m away (<=100 m)
    const latOffset = simulateFarAway ? 0.0031 : 0.00012;
    const res = inspectorStartJob({
      job_id: jobId,
      inspector_id: user?.id || 'usr-inspector-1',
      inspector_lat: Number((targetLat + latOffset).toFixed(6)),
      inspector_lon: Number((targetLon + 0.00005).toFixed(6)),
      max_geofence_m: 100.0,
    });
    setGeofenceBanner({
      jobId,
      ok: res.started,
      text: res.message,
    });
  };

  const handleSubmitFieldReport = (jobId: string) => {
    const summary =
      reportSummaryMap[jobId]?.trim() ||
      'On-site inspection completed within 100m geofence. Survey beacons, road access, and utility meters verified with timestamped in-app capture.';
    const defaultChecklist: ConditionItem[] = [
      { category: 'roof', rating: 'good', notes: 'Inspected on-site; no leakage' },
      { category: 'walls_cracks', rating: 'good', notes: 'Plumb blockwork, zero structural cracks' },
      { category: 'electrical', rating: 'good', notes: 'Prepaid meter & earthing confirmed' },
      { category: 'drainage_flooding', rating: 'good', notes: 'Storm drain clear and above road crown' },
      { category: 'fence_gate', rating: 'good', notes: 'Perimeter wall and beacons verified' },
      { category: 'access_road', rating: 'good', notes: 'Motorable road access confirmed' },
    ];
    inspectorSubmitReport({
      job_id: jobId,
      inspector_id: user?.id || 'usr-inspector-1',
      inspector_name: user?.name || 'Surv. Ibrahim Musa (Inspector)',
      report_summary: summary,
      checklist_items: defaultChecklist,
      media_caption:
        mediaCaptionMap[jobId]?.trim() ||
        'In-app geotagged site verification capture (<=100m geofence)',
      media_type: mediaTypeMap[jobId] || 'photo',
      preview_url:
        'https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=800&q=80',
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <Navigation className="w-3.5 h-3.5" />
              Phase 3 · Part D1 Inspector Workflow
            </span>
            <h1 className="text-2xl font-bold mt-2">
              Diaspora & Buyer Field Inspection Workflow
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-3xl">
              Buyers and renters (especially Nigerians in the diaspora) request an independent physical inspection. Admin assigns a vetted inspector who must be within{' '}
              <strong>100 m of the property</strong> to unlock the inspection checklist, capture timestamped in-app photos/video, and seal an immutable SHA-256 audit report. No payments are processed on the platform.
            </p>
          </div>
          <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3.5 text-xs text-slate-300 max-w-xs">
            <div className="font-semibold text-amber-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              Mandatory Legal Notice
            </div>
            <p className="mt-1">{MEASUREMENT_DISCLAIMER}</p>
          </div>
        </div>
      </div>

      {/* Request Inspection Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Globe2 className="w-5 h-5 text-emerald-600" />
          1. Request an On-Site Physical Inspection (Buyer / Diaspora Renter)
        </h2>
        <form
          onSubmit={handleRequestSubmit}
          className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Target Type
            </label>
            <select
              value={targetType}
              onChange={(e) => {
                const nextType = e.target.value as 'plot' | 'building';
                setTargetType(nextType);
                setTargetId(
                  nextType === 'plot'
                    ? plots[0]?.id || ''
                    : buildings[0]?.id || ''
                );
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              <option value="plot">Land Plot (Part B)</option>
              <option value="building">Built House / Apartment (Part C)</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Plot or Building to Inspect
            </label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              {targetType === 'plot'
                ? plots.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.lga}, {p.state} — {p.computed_area_m2} m²)
                    </option>
                  ))
                : buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title} ({b.lga}, {b.state} — {b.units.length} units)
                    </option>
                  ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isDiaspora}
                onChange={(e) => setIsDiaspora(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600"
              />
              Diaspora / Remote Buyer Request
            </label>
            <button
              type="submit"
              className="w-full px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition"
            >
              Submit Inspection Request
            </button>
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Specific Instructions for Field Inspector (e.g., check survey beacons, transformer load, flood marks)
            </label>
            <input
              type="text"
              value={requesterNote}
              onChange={(e) => setRequesterNote(e.target.value)}
              placeholder="e.g., Verify all 4 corner beacons against uploaded survey plan and photograph street drainage..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </form>
      </div>

      {/* Inspection Jobs List */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-900">
          2. Active & Completed Field Inspection Queue ({inspections.length})
        </h2>

        {inspections.map((job) => (
          <div
            key={job.id}
            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono text-slate-500">{job.id}</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-800 uppercase">
                    {job.target_type}
                  </span>
                  {job.is_diaspora_requester && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-900 border border-indigo-200">
                      Diaspora Buyer Request
                    </span>
                  )}
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      job.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : job.status === 'in_progress'
                        ? 'bg-sky-100 text-sky-900 border border-sky-300'
                        : job.status === 'assigned'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-slate-100 text-slate-700 border border-slate-300'
                    }`}
                  >
                    Status: {job.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {job.target_title} — {job.target_lga}, {job.target_state}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Requested by <strong>{job.requester_name}</strong> · Target Coordinates:{' '}
                  <code>
                    {job.target_lat.toFixed(5)}°N, {job.target_lon.toFixed(5)}°E
                  </code>
                </p>
              </div>

              {/* Admin manual inspector assignment */}
              {job.status === 'requested' && (
                <button
                  type="button"
                  onClick={() =>
                    adminAssignInspector({
                      job_id: job.id,
                      inspector_id: 'usr-inspector-1',
                      inspector_name: 'Surv. Ibrahim Musa (Inspector)',
                      admin_id: user?.id || 'usr-admin-1',
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                >
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  Admin: Assign Surv. Ibrahim Musa (Manual v1)
                </button>
              )}
            </div>

            <div className="p-5 space-y-4">
              <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <strong>Buyer Instructions:</strong> {job.requester_note}
              </div>

              {job.assigned_inspector_name && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                  <span>
                    Assigned Inspector: <strong>{job.assigned_inspector_name}</strong>
                  </span>
                  {job.distance_to_target_m !== undefined && (
                    <span className="inline-flex items-center gap-1 text-emerald-800 font-semibold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                      <MapPin className="w-3.5 h-3.5" />
                      Started {job.distance_to_target_m} m from target (within 100 m geofence)
                    </span>
                  )}
                </div>
              )}

              {/* D1: 100m Geofence Start Check */}
              {job.status === 'assigned' && (
                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-3">
                  <div className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-amber-700" />
                    Step 2 (Rule D1): Inspector 100 m Geofence Verification Before Starting
                  </div>
                  <p className="text-xs text-amber-900">
                    The assigned inspector must physically stand within{' '}
                    <strong>100 m (configurable)</strong> of the property coordinates before the checklist and camera unlock. Test both scenarios below:
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        handleSimulateGeofenceStart(
                          job.id,
                          job.target_lat,
                          job.target_lon,
                          true
                        )
                      }
                      className="px-3.5 py-2 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold"
                    >
                      Simulate Start 345 m Away (Blocked &gt;100 m)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleSimulateGeofenceStart(
                          job.id,
                          job.target_lat,
                          job.target_lon,
                          false
                        )
                      }
                      className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
                    >
                      Start On-Site at 14 m Distance (&le;100 m Geofence)
                    </button>
                  </div>
                </div>
              )}

              {geofenceBanner && geofenceBanner.jobId === job.id && (
                <div
                  className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                    geofenceBanner.ok
                      ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
                      : 'bg-rose-50 text-rose-900 border border-rose-300'
                  }`}
                >
                  {geofenceBanner.ok ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-700" />
                  )}
                  {geofenceBanner.text}
                </div>
              )}

              {/* D1: In-Progress Field Checklist & In-App Photo/Video Submission */}
              {job.status === 'in_progress' && (
                <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200 space-y-3">
                  <div className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-sky-700" />
                    Step 3 (Rule D1): Complete On-Site Checklist, Capture In-App Photo/Video & Seal Immutable Report
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Inspector Field Findings & Beacon/Utility Summary
                      </label>
                      <input
                        type="text"
                        value={reportSummaryMap[job.id] || ''}
                        onChange={(e) =>
                          setReportSummaryMap((prev) => ({
                            ...prev,
                            [job.id]: e.target.value,
                          }))
                        }
                        placeholder="e.g., Inspected borehole treatment plant, EKEDC prepaid meter, and storm drainage..."
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        In-App Capture Type
                      </label>
                      <select
                        value={mediaTypeMap[job.id] || 'photo'}
                        onChange={(e) =>
                          setMediaTypeMap((prev) => ({
                            ...prev,
                            [job.id]: e.target.value as 'photo' | 'video',
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white"
                      >
                        <option value="photo">In-App Geotagged Photo</option>
                        <option value="video">In-App Timestamped Walkthrough Video</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      In-App Media Evidence Caption
                    </label>
                    <input
                      type="text"
                      value={mediaCaptionMap[job.id] || ''}
                      onChange={(e) =>
                        setMediaCaptionMap((prev) => ({
                          ...prev,
                          [job.id]: e.target.value,
                        }))
                      }
                      placeholder="e.g., Corner beacon #2 & tarred road drain captured live in-app"
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSubmitFieldReport(job.id)}
                    className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                  >
                    Submit Report & Seal in SHA-256 Audit Chain
                  </button>
                </div>
              )}

              {/* Completed Immutable Report View + Buyer Rating */}
              {job.status === 'completed' && (
                <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-950">
                      <Lock className="w-3.5 h-3.5 text-emerald-700" />
                      Immutable Field Report Sealed in Audit Chain
                    </span>
                    {job.immutable_audit_hash && (
                      <span className="text-[11px] font-mono bg-white px-2.5 py-1 rounded border border-emerald-200 text-slate-700">
                        SHA-256: {job.immutable_audit_hash.slice(0, 24)}...
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-800">{job.report_summary}</p>

                  {job.media.length > 0 && (
                    <div className="flex flex-wrap gap-3 pt-1">
                      {job.media.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center gap-2.5 bg-white p-2 rounded-lg border border-slate-200 text-xs"
                        >
                          <img
                            src={m.preview_url}
                            alt={m.caption}
                            className="w-12 h-12 rounded object-cover"
                          />
                          <div>
                            <div className="font-semibold text-slate-800">
                              [{m.media_type.toUpperCase()} · captured in-app] {m.caption}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {m.captured_at} · SHA-256: {m.sha256_hash.slice(0, 12)}...
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Buyer Rating after completion */}
                  <div className="pt-3 border-t border-emerald-200/80 flex flex-wrap items-center justify-between gap-3">
                    {job.buyer_rating ? (
                      <div className="text-xs text-emerald-950 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 font-bold text-amber-600">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                          {job.buyer_rating} / 5 Stars
                        </span>
                        <span>— “{job.buyer_review_comment}”</span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 w-full">
                        <span className="text-xs font-semibold text-slate-700">
                          Rate Completed Inspection:
                        </span>
                        <select
                          value={ratingValMap[job.id] || 5}
                          onChange={(e) =>
                            setRatingValMap((prev) => ({
                              ...prev,
                              [job.id]: Number(e.target.value),
                            }))
                          }
                          className="rounded border border-slate-300 px-2 py-1 text-xs bg-white"
                        >
                          <option value={5}>5 Stars — Excellent</option>
                          <option value={4}>4 Stars — Good</option>
                          <option value={3}>3 Stars — Adequate</option>
                          <option value={2}>2 Stars — Poor</option>
                          <option value={1}>1 Star — Unsatisfactory</option>
                        </select>
                        <input
                          type="text"
                          value={ratingCommentMap[job.id] || ''}
                          onChange={(e) =>
                            setRatingCommentMap((prev) => ({
                              ...prev,
                              [job.id]: e.target.value,
                            }))
                          }
                          placeholder="Add review comment..."
                          className="flex-1 min-w-[180px] rounded border border-slate-300 px-2.5 py-1 text-xs bg-white"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            rateInspection({
                              job_id: job.id,
                              actor_id: user?.id || 'usr-buyer-1',
                              rating: ratingValMap[job.id] || 5,
                              review_comment:
                                ratingCommentMap[job.id]?.trim() ||
                                'Detailed on-site inspection report.',
                            })
                          }
                          className="px-3 py-1 rounded bg-emerald-700 text-white text-xs font-semibold"
                        >
                          Save Rating
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InspectionsPage;

