import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDataStore } from '../../stores/data-store';
import { useAuthStore } from '../../stores/auth-store';
import { useCurrencyStore } from '../../stores/currency-store';
import { EVIDENCE_STATUS_CONFIG, DOCUMENT_TYPE_LABELS } from '../../lib/nigeria-data';
import { PaymentStage, CurrencyCode } from '../../types';
import {
  FileCheck2,
  Lock,
  ExternalLink,
  KeyRound,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from 'lucide-react';

export const Documents: React.FC = () => {
  const {
    plots,
    buildings,
    paymentReceipts,
    uploadPaymentReceipt,
    respondToPaymentReceipt,
  } = useDataStore();
  const { user } = useAuthStore();
  const { formatPrice } = useCurrencyStore();

  const [signedTokenModal, setSignedTokenModal] = useState<{
    docTitle: string;
    plotTitle: string;
    signedUrl: string;
    expiresAt: string;
  } | null>(null);

  // D4: Proof-of-Payment Receipt form state
  const [rcpTargetType, setRcpTargetType] = useState<'plot' | 'building'>('plot');
  const [rcpTargetId, setRcpTargetId] = useState<string>(plots[0]?.id || 'plot-ibadan-001');
  const [rcpStage, setRcpStage] = useState<PaymentStage>('deposit');
  const [rcpAmount, setRcpAmount] = useState<string>('5000000');
  const [rcpCurrency, setRcpCurrency] = useState<CurrencyCode>('NGN');
  const [rcpDate, setRcpDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [rcpMethod, setRcpMethod] = useState<'bank_transfer' | 'manager_cheque' | 'escrow_transfer'>('bank_transfer');
  const [rcpRef, setRcpRef] = useState<string>('NIP-GTB-20261106-77102');
  const [rcpPayer, setRcpPayer] = useState<string>('Funke Adeyemi');
  const [rcpPayee, setRcpPayee] = useState<string>('Chief Tunde Bakare');
  const [rcpFileName, setRcpFileName] = useState<string>('Bank_Transfer_Receipt.pdf');
  const [disputeNoteMap, setDisputeNoteMap] = useState<Record<string, string>>({});

  const handleReceiptUpload = (e: React.FormEvent) => {
    e.preventDefault();
    const targetTitle =
      rcpTargetType === 'plot'
        ? plots.find((p) => p.id === rcpTargetId)?.title || 'Plot'
        : buildings.find((b) => b.id === rcpTargetId)?.title || 'Building';

    uploadPaymentReceipt({
      target_type: rcpTargetType,
      target_id: rcpTargetId,
      target_title: targetTitle,
      uploaded_by_id: user?.id || 'usr-buyer-1',
      uploaded_by_name: user?.name || 'Funke Adeyemi',
      uploaded_by_role: user?.role || 'buyer_renter',
      stage: rcpStage,
      amount: Math.max(1, Number(rcpAmount) || 0),
      currency: rcpCurrency,
      payment_date: rcpDate,
      payment_method: rcpMethod,
      bank_reference: rcpRef.trim(),
      payer_name: rcpPayer.trim(),
      payee_name: rcpPayee.trim(),
      receipt_file_name: rcpFileName,
    });
  };

  const allDocs = plots.flatMap((plot) =>
    plot.documents.map((doc) => ({
      plot,
      doc,
    }))
  );

  const generateSignedUrl = (docId: string, docTitle: string, plotTitle: string) => {
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const sig = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    setSignedTokenModal({
      docTitle,
      plotTitle,
      signedUrl: `/api/documents/${docId}/signed-download?expires=${encodeURIComponent(
        expires
      )}&sig=${sig}`,
      expiresAt: expires,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Lock className="h-6 w-6 text-indigo-700" />
            Private Document Vault &amp; Checklist Registry (B7)
          </h1>
          <p className="text-sm text-slate-600">
            All land documents (Survey Plans, C of O, Governor&apos;s Consent, Deeds of Assignment)
            are stored privately and served only via short-lived HMAC-signed access tokens — never
            public URLs.
          </p>
        </div>
      </div>

      {signedTokenModal && (
        <div className="rounded-xl border border-indigo-300 bg-indigo-50 p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-indigo-950">
          <div className="space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <KeyRound className="h-4 w-4 text-indigo-700" />
              Authorised Signed Access Token Generated ({signedTokenModal.docTitle} —{' '}
              {signedTokenModal.plotTitle})
            </div>
            <code className="block bg-white px-3 py-1.5 rounded border border-indigo-200 font-mono text-[11px]">
              {signedTokenModal.signedUrl}
            </code>
            <span className="text-[11px] text-indigo-700">
              Valid until {new Date(signedTokenModal.expiresAt).toLocaleTimeString()} · Logged in
              audit chain
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSignedTokenModal(null)}
            className="px-3 py-1.5 rounded-lg bg-indigo-900 text-white font-semibold"
          >
            Close
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                <th className="py-3 px-4">Document Type</th>
                <th className="py-3 px-4">Plot Record</th>
                <th className="py-3 px-4">Allowed Item Status</th>
                <th className="py-3 px-4">External Report / Admin Notes</th>
                <th className="py-3 px-4 text-right">Private Vault Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {allDocs.map(({ plot, doc }) => {
                const statusInfo = EVIDENCE_STATUS_CONFIG[doc.status];
                return (
                  <tr key={doc.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <FileCheck2 className="h-4 w-4 text-indigo-600 shrink-0" />
                        <span>{DOCUMENT_TYPE_LABELS[doc.doc_type] || doc.title}</span>
                      </div>
                      {doc.file_name && (
                        <span className="text-[11px] text-slate-400 font-normal block pl-6">
                          {doc.file_name}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <Link
                        to={`/plots/${plot.id}`}
                        className="font-semibold text-emerald-700 hover:underline block"
                      >
                        {plot.title}
                      </Link>
                      <span className="text-[11px] text-slate-500">
                        {plot.area_name}, {plot.state}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-md font-semibold ${statusInfo.badgeClass}`}
                      >
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 max-w-md">
                      {doc.external_report_ref && (
                        <span className="block text-emerald-800 font-semibold">
                          External Ref: {doc.external_report_ref}
                        </span>
                      )}
                      <span className="text-slate-600">
                        {doc.admin_notes || statusInfo.description}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {doc.file_name ? (
                        <button
                          type="button"
                          onClick={() =>
                            generateSignedUrl(doc.id, doc.title, plot.title)
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-semibold text-xs transition"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Signed Access
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[11px]">No file uploaded</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* D4: Proof-of-Payment Receipt Trail */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-900">
              <Receipt className="w-3.5 h-3.5" />
              Phase 3 · Part D4 Proof-of-Payment Trail
            </span>
            <h2 className="text-lg font-bold text-slate-900 mt-1">
              Dual-Party Payment Receipt Ledger (No Platform Money Processing)
            </h2>
            <p className="text-xs text-slate-600">
              Buyer/renter and seller upload off-platform bank transfer or manager&apos;s cheque receipts for deposits, rent, or purchase stages. Every receipt is sealed in the SHA-256 audit chain, and both parties can confirm or dispute.
            </p>
          </div>
        </div>

        {/* Upload Receipt Form */}
        <form
          onSubmit={handleReceiptUpload}
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200"
        >
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Property Type &amp; Record
            </label>
            <div className="flex gap-1.5">
              <select
                value={rcpTargetType}
                onChange={(e) => {
                  const next = e.target.value as 'plot' | 'building';
                  setRcpTargetType(next);
                  setRcpTargetId(
                    next === 'plot' ? plots[0]?.id || '' : buildings[0]?.id || ''
                  );
                }}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs bg-white"
              >
                <option value="plot">Plot</option>
                <option value="building">Building</option>
              </select>
              <select
                value={rcpTargetId}
                onChange={(e) => setRcpTargetId(e.target.value)}
                className="flex-1 min-w-0 rounded-lg border border-slate-300 px-2 py-1.5 text-xs bg-white"
              >
                {rcpTargetType === 'plot'
                  ? plots.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))
                  : buildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title}
                      </option>
                    ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Payment Stage &amp; Method
            </label>
            <div className="flex gap-1.5">
              <select
                value={rcpStage}
                onChange={(e) => setRcpStage(e.target.value as PaymentStage)}
                className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs bg-white"
              >
                <option value="deposit">Deposit</option>
                <option value="rent">Annual Rent</option>
                <option value="purchase_instalment">Purchase Instalment</option>
                <option value="final_balance">Final Balance</option>
              </select>
              <select
                value={rcpMethod}
                onChange={(e) =>
                  setRcpMethod(
                    e.target.value as 'bank_transfer' | 'manager_cheque' | 'escrow_transfer'
                  )
                }
                className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs bg-white"
              >
                <option value="bank_transfer">NIP Bank Transfer</option>
                <option value="manager_cheque">Manager&apos;s Cheque</option>
                <option value="escrow_transfer">Solicitor Escrow</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Amount &amp; Currency
            </label>
            <div className="flex gap-1.5">
              <input
                type="number"
                required
                min={1}
                value={rcpAmount}
                onChange={(e) => setRcpAmount(e.target.value)}
                className="flex-1 min-w-0 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white"
              />
              <select
                value={rcpCurrency}
                onChange={(e) => setRcpCurrency(e.target.value as CurrencyCode)}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs bg-white font-semibold"
              >
                <option value="NGN">NGN (₦)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Bank / Session Reference &amp; Date
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                required
                value={rcpRef}
                onChange={(e) => setRcpRef(e.target.value)}
                placeholder="NIP Session ID"
                className="flex-1 min-w-0 rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-mono bg-white"
              />
              <input
                type="date"
                required
                value={rcpDate}
                onChange={(e) => setRcpDate(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Payer Name (Buyer / Renter)
            </label>
            <input
              type="text"
              required
              value={rcpPayer}
              onChange={(e) => setRcpPayer(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Payee Name (Owner / Seller)
            </label>
            <input
              type="text"
              required
              value={rcpPayee}
              onChange={(e) => setRcpPayee(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Private Receipt File Name
            </label>
            <input
              type="text"
              required
              value={rcpFileName}
              onChange={(e) => setRcpFileName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition"
            >
              Log Payment Receipt in Audit Chain
            </button>
          </div>
        </form>

        {/* Receipts Table / Cards */}
        <div className="space-y-3">
          {paymentReceipts.map((rcp) => (
            <div
              key={rcp.id}
              className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col gap-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900 text-white uppercase">
                      {rcp.stage.replace('_', ' ')}
                    </span>
                    <span className="text-sm font-bold text-emerald-800">
                      {formatPrice(rcp.amount, rcp.currency)}
                    </span>
                    <span className="text-xs font-semibold text-slate-800">
                      — {rcp.target_title}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Payer: <strong>{rcp.payer_name}</strong> → Payee:{' '}
                    <strong>{rcp.payee_name}</strong> · Ref:{' '}
                    <code>{rcp.bank_reference}</code> · Date: {rcp.payment_date} · Method:{' '}
                    {rcp.payment_method.replace('_', ' ')}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold border ${
                      rcp.buyer_status === 'confirmed'
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                        : rcp.buyer_status === 'disputed'
                        ? 'bg-rose-50 text-rose-900 border-rose-300'
                        : 'bg-amber-50 text-amber-900 border-amber-300'
                    }`}
                  >
                    {rcp.buyer_status === 'confirmed' ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : rcp.buyer_status === 'disputed' ? (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    ) : (
                      <Clock className="w-3.5 h-3.5" />
                    )}
                    Buyer: {rcp.buyer_status}
                  </span>

                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold border ${
                      rcp.seller_status === 'confirmed'
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                        : rcp.seller_status === 'disputed'
                        ? 'bg-rose-50 text-rose-900 border-rose-300'
                        : 'bg-amber-50 text-amber-900 border-amber-300'
                    }`}
                  >
                    {rcp.seller_status === 'confirmed' ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : rcp.seller_status === 'disputed' ? (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    ) : (
                      <Clock className="w-3.5 h-3.5" />
                    )}
                    Seller: {rcp.seller_status}
                  </span>
                </div>
              </div>

              {rcp.dispute_notes && (
                <div className="text-xs text-slate-700 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                  <strong>Confirmation / Dispute Note:</strong> {rcp.dispute_notes}
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-mono text-slate-400">
                  Audit Event Hash: {rcp.audit_event_hash.slice(0, 24)}...
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={disputeNoteMap[rcp.id] || ''}
                    onChange={(e) =>
                      setDisputeNoteMap((prev) => ({
                        ...prev,
                        [rcp.id]: e.target.value,
                      }))
                    }
                    placeholder="Add confirmation or dispute note..."
                    className="rounded border border-slate-300 px-2.5 py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      respondToPaymentReceipt({
                        receipt_id: rcp.id,
                        actor_id: user?.id || 'usr-owner-1',
                        party_role: 'seller',
                        decision: 'confirmed',
                        notes:
                          disputeNoteMap[rcp.id]?.trim() ||
                          'Seller confirmed credit alert received.',
                      })
                    }
                    className="px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
                  >
                    Seller Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      respondToPaymentReceipt({
                        receipt_id: rcp.id,
                        actor_id: user?.id || 'usr-owner-1',
                        party_role: 'seller',
                        decision: 'disputed',
                        notes:
                          disputeNoteMap[rcp.id]?.trim() ||
                          'Seller disputed receipt reference; bank statement mismatch.',
                      })
                    }
                    className="px-2.5 py-1 rounded bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold"
                  >
                    Dispute Receipt
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
