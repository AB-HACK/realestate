import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';
import { Compass, ShieldCheck, ArrowRight } from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, demoUsers } = useAuthStore();

  const [email, setEmail] = useState('admin@aecren.ng');
  const [password, setPassword] = useState('password123');
  const [ndpaConsent, setNdpaConsent] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!ndpaConsent) {
      setError(
        'Please confirm consent under the Nigeria Data Protection Act (NDPA) 2023 to proceed.'
      );
      return;
    }
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch {
      setError('Invalid credentials.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-emerald-600 text-white shadow-lg">
          <Compass className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">
          AecrenEvidence Nigeria
        </h1>
        <p className="text-xs text-slate-400">
          Evidence-First Land &amp; Property Platform · Geodesic Boundary Capture &amp; Tamper-Evident
          Audit Log
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-slate-900 border border-slate-800 py-6 px-6 shadow-xl rounded-2xl space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950 border border-rose-800 text-xs text-rose-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex items-start gap-2.5 bg-slate-950/80 p-3 rounded-lg border border-slate-800">
              <input
                id="ndpa-login"
                type="checkbox"
                checked={ndpaConsent}
                onChange={(e) => setNdpaConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-700 text-emerald-600"
              />
              <label htmlFor="ndpa-login" className="text-[11px] text-slate-300 leading-relaxed">
                <strong>NDPA 2023 Data Consent:</strong> I consent to minimal processing of GPS
                boundary coordinates, geotagged site photos, and audit metadata under the Nigeria
                Data Protection Act 2023.
              </label>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-sm transition"
            >
              <span>Sign In to Evidence Platform</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* 1-Click RBAC Role Demo Accounts */}
          <div className="pt-4 border-t border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Quick Sign-In by Role (6 RBAC Accounts)
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {demoUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={async () => {
                    await login(u.email, 'demo');
                    navigate('/dashboard');
                  }}
                  className="p-2 rounded-lg border border-slate-800 bg-slate-950 hover:border-emerald-500/60 text-left transition"
                >
                  <span className="text-[10px] font-bold uppercase text-emerald-400 block">
                    {u.role.replace('_', '/')}
                  </span>
                  <span className="text-xs font-semibold text-white truncate block">
                    {u.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <p className="text-center text-xs text-slate-400 pt-2">
            Need a new account?{' '}
            <Link to="/register" className="text-emerald-400 hover:underline font-semibold">
              Register with NDPA Consent
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
