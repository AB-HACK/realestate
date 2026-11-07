import React from 'react';
import { useDataStore } from '../../stores/data-store';
import {
  Link2,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Flame,
  RotateCcw,
} from 'lucide-react';

export const AuditLog: React.FC = () => {
  const {
    auditEvents,
    auditVerification,
    verifyAuditChain,
    simulateTamperOnAuditRow,
    restoreTamperedAuditChain,
  } = useDataStore();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Link2 className="h-6 w-6 text-emerald-700" />
            B8. Tamper-Evident SHA-256 Audit Log &amp; Chain Verifier
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Append-only event log where <code>hash = SHA-256(prev_hash + canonical_payload)</code>.
            This log is <strong>tamper-evident</strong> (not tamper-proof): any retroactive row
            modification breaks the cryptographic hash chain on <code>/audit/verify</code>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => verifyAuditChain()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Run /audit/verify Now
          </button>

          {auditVerification.valid && auditEvents.length > 0 ? (
            <button
              type="button"
              onClick={() => simulateTamperOnAuditRow(auditEvents[0].seq)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold transition"
              title="Simulate a direct DB row edit on seq #1 to prove /audit/verify detects tampering"
            >
              <Flame className="h-3.5 w-3.5" />
              Simulate Tampering on Row #1
            </button>
          ) : (
            <button
              type="button"
              onClick={restoreTamperedAuditChain}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restore Intact Audit Chain
            </button>
          )}
        </div>
      </div>

      {/* Live /audit/verify Status Banner */}
      <div
        className={`rounded-2xl border p-5 flex items-start gap-3.5 ${
          auditVerification.valid
            ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
            : 'bg-rose-50 border-rose-300 text-rose-950'
        }`}
      >
        {auditVerification.valid ? (
          <ShieldCheck className="h-6 w-6 text-emerald-700 shrink-0 mt-0.5" />
        ) : (
          <ShieldAlert className="h-6 w-6 text-rose-700 shrink-0 mt-0.5" />
        )}
        <div className="space-y-1 text-xs">
          <div className="text-sm font-bold">
            {auditVerification.valid
              ? 'GET /audit/verify — Hash Chain Verified Intact'
              : `GET /audit/verify — TAMPER DETECTED at Sequence #${auditVerification.first_mismatch_seq}!`}
          </div>
          <p>{auditVerification.description}</p>
          {!auditVerification.valid && (
            <p className="font-semibold text-rose-800">
              Mismatch Reason: {auditVerification.mismatch_reason}
            </p>
          )}
          <p className="text-[11px] opacity-80">
            Total Events Checked: {auditVerification.checked_count} · DB Triggers:{' '}
            <code>trg_audit_events_no_update</code> &amp; <code>trg_audit_events_no_delete</code>
          </p>
        </div>
      </div>

      {/* Append-Only Event Chain Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-200 text-[11px] font-semibold uppercase">
                <th className="py-3 px-4">Seq</th>
                <th className="py-3 px-4">Event Type &amp; Entity</th>
                <th className="py-3 px-4">Actor &amp; Timestamp</th>
                <th className="py-3 px-4">Canonical Payload JSON</th>
                <th className="py-3 px-4">Prev Hash → Event Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {auditEvents.map((ev) => {
                const isMismatched =
                  !auditVerification.valid &&
                  auditVerification.first_mismatch_seq === ev.seq;

                return (
                  <tr
                    key={ev.seq}
                    className={
                      isMismatched
                        ? 'bg-rose-50/90 hover:bg-rose-100/80'
                        : 'hover:bg-slate-50'
                    }
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      #{ev.seq}
                      {isMismatched && (
                        <span className="block text-[10px] text-rose-700 font-sans font-bold">
                          MISMATCH
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-900 font-mono font-semibold text-[11px]">
                        {ev.event_type}
                      </span>
                      <span className="block text-[11px] text-slate-500 mt-1">
                        {ev.entity_type}: <code>{ev.entity_id}</code>
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800 block">
                        Actor: {ev.actor_id}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {new Date(ev.created_at).toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 max-w-md">
                      <pre className="text-[10px] font-mono bg-slate-950 text-emerald-300 p-2.5 rounded-lg overflow-x-auto">
                        {ev.payload_json}
                      </pre>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[10px] text-slate-600 space-y-1">
                      <div>
                        <span className="text-slate-400">prev:</span>{' '}
                        {ev.prev_hash.slice(0, 18)}...
                      </div>
                      <div className="text-emerald-800 font-bold">
                        <span className="text-slate-400 font-normal">hash:</span>{' '}
                        {ev.hash.slice(0, 18)}...
                      </div>
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

