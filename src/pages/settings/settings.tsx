import React, { useState } from 'react';
import { useAuthStore } from '../../stores/auth-store';
import { useCurrencyStore } from '../../stores/currency-store';
import { ShieldCheck, Coins, Sliders, CheckCircle2 } from 'lucide-react';

export const Settings: React.FC = () => {
  const { user, demoUsers, switchRole } = useAuthStore();
  const { displayCurrency, setCurrency, ngnPerUsd, setExchangeRate } = useCurrencyStore();
  const [rateInput, setRateInput] = useState(String(ngnPerUsd));
  const [savedBanner, setSavedBanner] = useState(false);

  const handleSaveRate = (e: React.FormEvent) => {
    e.preventDefault();
    setExchangeRate(Number(rateInput) || 1600);
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Platform Settings, Currency &amp; NDPA 2023 Compliance
        </h1>
        <p className="text-sm text-slate-600">
          Configure Naira/Dollar exchange rates, test Role-Based Access Control (RBAC), and inspect
          Nigeria Data Protection Act 2023 consent records.
        </p>
      </div>

      {savedBanner && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          Settings saved and applied across all listings.
        </div>
      )}

      {/* Currency & Exchange Rate */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Coins className="h-5 w-5 text-emerald-600" />
          Dual Currency Switcher (NGN ₦ ↔ USD $)
        </h2>
        <form onSubmit={handleSaveRate} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Active Display Currency
            </label>
            <select
              value={displayCurrency}
              onChange={(e) => setCurrency(e.target.value as 'NGN' | 'USD')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white font-semibold"
            >
              <option value="NGN">Nigerian Naira (₦ NGN)</option>
              <option value="USD">US Dollar ($ USD)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Exchange Rate (₦ per $1 USD)
            </label>
            <input
              type="number"
              min={100}
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold"
          >
            Update Exchange Rate
          </button>
        </form>
      </div>

      {/* Role-Based Access Control (RBAC) Quick Switcher */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Sliders className="h-5 w-5 text-indigo-600" />
          Role-Based Access Control (RBAC) Simulator (6 Roles)
        </h2>
        <p className="text-xs text-slate-600">
          Switch between the 6 required platform roles (<code>visitor</code>,{' '}
          <code>buyer_renter</code>, <code>owner</code>, <code>agent</code>, <code>inspector</code>,{' '}
          <code>admin</code>) to verify endpoint and UI permissions.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {demoUsers.map((u) => {
            const active = user?.id === u.id;
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => switchRole(u.role)}
                className={`p-3.5 rounded-xl border text-left transition ${active
                  ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:bg-slate-50'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-emerald-800">{u.role}</span>
                  {active && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-700 text-white font-semibold">
                      Active
                    </span>
                  )}
                </div>
                <div className="text-sm font-bold text-slate-900 mt-1">{u.name}</div>
                <div className="text-[11px] text-slate-500">{u.email}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* NDPA 2023 Consent & Configurable Thresholds */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          Nigeria Data Protection Act (NDPA) 2023 &amp; Phase 1 Thresholds
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block">NDPA Consent Status</span>
            <span className="font-bold text-emerald-800">
              Recorded ({user?.ndpa_consent_at || 'v2023.1'})
            </span>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block">Occupied Home Location Fuzzing</span>
            <span className="font-bold text-slate-900">~300 m Public Radius (Deterministic)</span>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block">GPS Corner Sample Filter</span>
            <span className="font-bold text-slate-900">
              ~10s window · Discard &gt;15m accuracy
            </span>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block">Spatial Overlap / Duplicate Thresholds</span>
            <span className="font-bold text-slate-900">
              ≥10% buffered intersection · ≤30m centroid &amp; ≤10% area
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
