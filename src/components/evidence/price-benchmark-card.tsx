import React, { useState } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Info,
  Flag,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';
import { useDataStore } from '../../stores/data-store';
import { useCurrencyStore } from '../../stores/currency-store';
import { useAuthStore } from '../../stores/auth-store';
import { SuspiciousReasonCategory } from '../../types';

interface PriceBenchmarkCardProps {
  targetType: 'plot' | 'building';
  targetId: string;
  targetTitle: string;
}

export const PriceBenchmarkCard: React.FC<PriceBenchmarkCardProps> = ({
  targetType,
  targetId,
  targetTitle,
}) => {
  const [radiusKm, setRadiusKm] = useState<number>(3.0);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reasonCategory, setReasonCategory] = useState<SuspiciousReasonCategory>(
    'unverified_agent_deposit_request'
  );
  const [reportDesc, setReportDesc] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);

  const { displayCurrency, ngnPerUsd, formatPrice } = useCurrencyStore();
  const { user } = useAuthStore();
  const getPriceBenchmark = useDataStore((s) => s.getPriceBenchmark);
  const reportSuspiciousListing = useDataStore((s) => s.reportSuspiciousListing);

  const benchmark = getPriceBenchmark({
    target_type: targetType,
    target_id: targetId,
    radius_km: radiusKm,
    exchange_rate_ngn_per_usd: ngnPerUsd,
  });

  if (!benchmark) return null;

  const formatPpm2 = (ppm2Ngn: number) => {
    return `${formatPrice(ppm2Ngn, 'NGN')}/m²`;
  };

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportDesc.trim()) return;
    reportSuspiciousListing({
      target_type: targetType,
      target_id: targetId,
      target_title: targetTitle,
      reporter_id: user?.id || 'usr-visitor',
      reporter_name: user?.name || 'Platform Visitor',
      reporter_role: user?.role || 'visitor',
      reason_category: reasonCategory,
      description: reportDesc.trim(),
    });
    setReportDesc('');
    setReportSubmitted(true);
    setShowReportForm(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          <div>
            <h3 className="text-sm font-semibold">
              D3. Geodesic Price per m² Benchmark ({displayCurrency})
            </h3>
            <p className="text-xs text-slate-300">
              {benchmark.indicative_disclaimer}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
          <label className="text-xs text-slate-300">Comparable Radius:</label>
          <select
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            className="bg-slate-800 text-white text-xs rounded-lg px-2.5 py-1.5 border border-slate-700"
          >
            <option value={0.5}>0.5 km (Test &lt;8 comps)</option>
            <option value={1.5}>1.5 km</option>
            <option value={3.0}>3.0 km (Default)</option>
            <option value={5.0}>5.0 km</option>
            <option value={10.0}>10.0 km</option>
          </select>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider font-medium">
              This Listing Price / m²
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">
              {formatPpm2(benchmark.target_price_per_m2_ngn)}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Compared against {benchmark.comparable_count} comparable {targetType}s within{' '}
              {benchmark.radius_km} km (min {benchmark.required_minimum_comps} required)
            </div>
          </div>

          <div>
            {benchmark.status === 'insufficient_data' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                <Info className="w-3.5 h-3.5" />
                Insufficient Data (&lt;{benchmark.required_minimum_comps} Comps)
              </span>
            ) : benchmark.is_extreme_outlier ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-900 border border-rose-300">
                <AlertTriangle className="w-3.5 h-3.5" />
                {benchmark.status_label}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {benchmark.status_label}
              </span>
            )}
          </div>
        </div>

        {benchmark.status === 'insufficient_data' ? (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
            <strong>{benchmark.status_label}.</strong> Per Phase 3 Rule D3, a percentile band
            (P5–P95) is only displayed when <strong>8 or more comparable listings</strong> exist
            within the selected radius. Increase the radius to <strong>3.0 km</strong> to inspect
            the full P5–P95 neighborhood distribution.
          </div>
        ) : (
          benchmark.percentile_band && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-500 font-medium">P5 (Lower Bound)</div>
                  <div className="text-xs font-bold text-slate-800 mt-0.5">
                    {formatPpm2(benchmark.percentile_band.p5_ngn)}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-500 font-medium">Q1 (25th Pct)</div>
                  <div className="text-xs font-bold text-slate-800 mt-0.5">
                    {formatPpm2(benchmark.percentile_band.q1_ngn)}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                  <div className="text-[11px] text-emerald-800 font-semibold">
                    Median (P50)
                  </div>
                  <div className="text-xs font-bold text-emerald-950 mt-0.5">
                    {formatPpm2(benchmark.percentile_band.median_ngn)}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-500 font-medium">Q3 (75th Pct)</div>
                  <div className="text-xs font-bold text-slate-800 mt-0.5">
                    {formatPpm2(benchmark.percentile_band.q3_ngn)}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-500 font-medium">P95 (Upper Bound)</div>
                  <div className="text-xs font-bold text-slate-800 mt-0.5">
                    {formatPpm2(benchmark.percentile_band.p95_ngn)}
                  </div>
                </div>
              </div>

              {benchmark.is_extreme_outlier && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900">
                  <strong>Outlier Notice (Indicative Only):</strong> This listing’s price per m²
                  falls outside the P5–P95 comparable band ({benchmark.outlier_direction === 'below_p5' ? 'below P5' : 'above P95'}). Buyers should request independent surveyor/solicitor due diligence before paying any deposit.
                </div>
              )}
            </div>
          )
        )}

        {/* D6: Suspicious Listing Report Trigger */}
        <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-500">
            Notice an unverified agent demanding a deposit or boundary mismatch?
          </span>
          <button
            type="button"
            onClick={() => setShowReportForm((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-3 py-1.5 rounded-lg transition"
          >
            <Flag className="w-3.5 h-3.5" />
            {showReportForm ? 'Cancel Report' : 'Report Suspicious Listing (D6)'}
          </button>
        </div>

        {reportSubmitted && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
            Report logged in the tamper-evident audit chain and routed to the Admin Review Queue.
          </div>
        )}

        {showReportForm && (
          <form
            onSubmit={handleReportSubmit}
            className="p-4 rounded-lg bg-amber-50/70 border border-amber-200 space-y-3"
          >
            <div className="text-xs font-semibold text-amber-950">
              Submit Suspicious Listing Report to Admin Queue (Rule D6)
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Concern Category
              </label>
              <select
                value={reasonCategory}
                onChange={(e) =>
                  setReasonCategory(e.target.value as SuspiciousReasonCategory)
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white"
              >
                <option value="unverified_agent_deposit_request">
                  Unregistered agent requesting upfront inspection/holding deposit
                </option>
                <option value="possible_duplicate_claim">
                  Possible duplicate claim on an already listed plot/unit
                </option>
                <option value="boundary_mismatch">
                  Polygon boundary / beacon coordinates mismatch physical site
                </option>
                <option value="occupied_property_misrepresented">
                  Occupied property misrepresented as vacant
                </option>
                <option value="other">Other evidence concern</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Factual Observation Details
              </label>
              <textarea
                rows={2}
                required
                value={reportDesc}
                onChange={(e) => setReportDesc(e.target.value)}
                placeholder="Describe what you observed (e.g., agent demanded deposit into personal account before showing survey plan)..."
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold"
            >
              Route Report to Admin Queue
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

