import React, { useState } from 'react';
import {
  UserCheck,
  ShieldAlert,
  FileCheck2,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Upload,
} from 'lucide-react';
import { useDataStore } from '../../stores/data-store';
import { useAuthStore } from '../../stores/auth-store';
import { EVIDENCE_STATUS_CONFIG } from '../../lib/nigeria-data';

export const AgentVerificationPage: React.FC = () => {
  const { user } = useAuthStore();
  const agentProfiles = useDataStore((s) => s.agentProfiles);
  const submitAgentProfile = useDataStore((s) => s.submitAgentProfile);
  const adminCheckAgentProfile = useDataStore((s) => s.adminCheckAgentProfile);

  const [agentName, setAgentName] = useState(user?.name || 'ESV Kunle Adebayo');
  const [agentEmail] = useState(user?.email || 'kunle.agent@aecren.ng');
  const [regBody, setRegBody] = useState('LASRERA');
  const [regNumber, setRegNumber] = useState('LASRERA/AG/2026/0814');
  const [idFileName, setIdFileName] = useState('LASRERA_Permit_Card_2026.pdf');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [rbacError, setRbacError] = useState<string | null>(null);

  const [checkDateMap, setCheckDateMap] = useState<Record<string, string>>({});
  const [adminNotesMap, setAdminNotesMap] = useState<Record<string, string>>({});

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
    ];
    if (!allowedTypes.includes(file.type)) {
      setUploadError(
        `Rejected MIME type "${file.type}" (Rule D6). Only PDF, JPEG, PNG, or WebP ID documents are accepted.`
      );
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError(
        `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 10 MB maximum upload limit (Rule D6).`
      );
      return;
    }
    setIdFileName(file.name);
  };

  const handleSubmitProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regNumber.trim()) return;
    submitAgentProfile({
      agent_id: `usr-agent-${Date.now()}`,
      agent_name: agentName.trim(),
      agent_email: agentEmail.trim(),
      registration_body: regBody,
      registration_number: regNumber.trim(),
      id_document_filename: idFileName,
    });
  };

  const handleAdminCheck = (
    profileId: string,
    outcome: 'checked_ok' | 'mismatch_noted',
    simulateSelfApprovalAsAgent: boolean = false
  ) => {
    setRbacError(null);
    try {
      adminCheckAgentProfile({
        profile_id: profileId,
        actor_id: user?.id || 'usr-admin-1',
        actor_role: simulateSelfApprovalAsAgent ? 'agent' : user?.role || 'admin',
        outcome,
        checked_on_date:
          checkDateMap[profileId] || new Date().toISOString().slice(0, 10),
        admin_notes:
          adminNotesMap[profileId]?.trim() ||
          `Official ${outcome === 'checked_ok' ? 'register match confirmed' : 'discrepancy noted'} by Admin.`,
      });
    } catch (err) {
      setRbacError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <UserCheck className="w-3.5 h-3.5" />
              Phase 3 · Part D2 Agent Verification Registry
            </span>
            <h1 className="text-2xl font-bold mt-2">
              Nigerian Real Estate Regulator & Professional Body Check
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-3xl">
              Agents submit their regulatory body (<strong>LASRERA</strong>,{' '}
              <strong>NIESV</strong>, <strong>ESVARBON</strong>, or <strong>REDAN</strong>), registration number, and privately stored ID document. Admin manually checks the official register and records the exact date and outcome. Badge text states{' '}
              <em>“Registration number checked by admin on &lt;date&gt;”</em> — never a blanket “verified” badge.
            </p>
          </div>
          <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3.5 text-xs text-slate-300 max-w-xs">
            <div className="font-semibold text-amber-300 flex items-center gap-1.5">
              <Lock className="w-4 h-4" />
              Strict Non-Self-Promotion Rule
            </div>
            <p className="mt-1">
              Agents cannot promote or approve their own verification status. All ID documents are stored in the private vault and served via signed URLs.
            </p>
          </div>
        </div>
      </div>

      {rbacError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-900 flex items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 text-rose-700 shrink-0" />
          <div>
            <strong>Blocked by RBAC Guard (HTTP 403):</strong> {rbacError}
          </div>
        </div>
      )}

      {/* Submit Agent Registration Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Upload className="w-5 h-5 text-emerald-600" />
          1. Submit Agent Regulatory Profile & Private ID Document
        </h2>

        {uploadError && (
          <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {uploadError}
          </div>
        )}

        <form
          onSubmit={handleSubmitProfile}
          className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-end"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Agent Full Name
            </label>
            <input
              type="text"
              required
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Registration Body (State / Professional Regulator)
            </label>
            <select
              value={regBody}
              onChange={(e) => setRegBody(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              <option value="LASRERA">
                LASRERA (Lagos State Real Estate Regulatory Authority)
              </option>
              <option value="NIESV">
                NIESV (Nigerian Institution of Estate Surveyors & Valuers)
              </option>
              <option value="ESVARBON">
                ESVARBON (Estate Surveyors & Valuers Registration Board of Nigeria)
              </option>
              <option value="REDAN">
                REDAN (Real Estate Developers Association of Nigeria)
              </option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Official Registration Number
            </label>
            <input
              type="text"
              required
              value={regNumber}
              onChange={(e) => setRegNumber(e.target.value)}
              placeholder="e.g., LASRERA/AG/2026/0814"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Private Regulatory Permit / Government ID (PDF, JPEG, PNG &le; 10 MB)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="text-xs text-slate-600"
              />
              <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded">
                Selected: {idFileName}
              </span>
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="w-full px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition"
            >
              Submit Profile (Status: uploaded)
            </button>
          </div>
        </form>
      </div>

      {/* Agent Profiles & Admin Register Check Queue */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-900">
          2. Registered Agent Profiles & Admin Manual Register Check Queue ({agentProfiles.length})
        </h2>

        {agentProfiles.map((prof) => {
          const statusCfg = EVIDENCE_STATUS_CONFIG[prof.status];
          return (
            <div
              key={prof.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      {prof.agent_name}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-semibold bg-slate-100 text-slate-800 border border-slate-300">
                      {prof.registration_body}: {prof.registration_number}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusCfg.badgeClass}`}
                    >
                      {statusCfg.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Private Vault ID Doc: <code>{prof.id_document_filename}</code> · SHA-256:{' '}
                    <code>{prof.id_document_sha256.slice(0, 18)}...</code>
                  </p>
                </div>

                {/* Exact Dated Badge (Rule D2) */}
                <div
                  className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                    prof.outcome === 'checked_ok'
                      ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
                      : 'bg-amber-50 text-amber-900 border-amber-300'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
                  <span>Badge: “{prof.badge_text}”</span>
                </div>
              </div>

              {prof.admin_notes && (
                <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <strong>Admin Register Check Note:</strong> {prof.admin_notes}
                </div>
              )}

              {/* Admin Check Controls + Self-Approval Block Demo */}
              <div className="pt-3 border-t border-slate-200 flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-wrap items-end gap-3 flex-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Register Check Date
                    </label>
                    <input
                      type="date"
                      value={
                        checkDateMap[prof.id] ||
                        prof.checked_on_date ||
                        new Date().toISOString().slice(0, 10)
                      }
                      onChange={(e) =>
                        setCheckDateMap((prev) => ({
                          ...prev,
                          [prof.id]: e.target.value,
                        }))
                      }
                      className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Official Register Verification Note
                    </label>
                    <input
                      type="text"
                      value={adminNotesMap[prof.id] || ''}
                      onChange={(e) =>
                        setAdminNotesMap((prev) => ({
                          ...prev,
                          [prof.id]: e.target.value,
                        }))
                      }
                      placeholder={`e.g., Checked ${prof.registration_number} on ${prof.registration_body} register...`}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleAdminCheck(prof.id, 'checked_ok', true)}
                    className="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-semibold"
                  >
                    Test Agent Self-Approve (Blocked 403)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdminCheck(prof.id, 'mismatch_noted', false)}
                    className="px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-300 text-xs font-semibold"
                  >
                    Admin: Flag Discrepancy
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdminCheck(prof.id, 'checked_ok', false)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                  >
                    <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />
                    Admin: Record Register Check
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AgentVerificationPage;
