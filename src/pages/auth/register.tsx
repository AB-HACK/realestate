import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';
import { UserRole } from '../../types';
import { Compass, ArrowRight } from 'lucide-react';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const { register } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('owner');
  const [ndpaConsent, setNdpaConsent] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!ndpaConsent) {
      setError('Explicit consent under the Nigeria Data Protection Act (NDPA) 2023 is required.');
      return;
    }
    try {
      await register(name, email, password, role, ndpaConsent);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-emerald-600 text-white shadow-lg">
          <Compass className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">
          Create Evidence Platform Account
        </h1>
        <p className="text-xs text-slate-400">
          Select your role and record NDPA 2023 data processing consent
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900 border border-slate-800 py-6 px-6 shadow-xl rounded-2xl space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950 border border-rose-800 text-xs text-rose-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Engr. Musa Danjuma"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.ng"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Platform Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="owner">Land / Property Owner</option>
                <option value="buyer_renter">Buyer / Renter</option>
                <option value="agent">Real Estate Agent</option>
                <option value="inspector">Field Inspector</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>

            <div className="flex items-start gap-2.5 bg-slate-950 p-3 rounded-lg border border-slate-800">
              <input
                id="ndpa-reg"
                type="checkbox"
                checked={ndpaConsent}
                onChange={(e) => setNdpaConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-700 text-emerald-600"
              />
              <label htmlFor="ndpa-reg" className="text-[11px] text-slate-300 leading-relaxed">
                I explicitly consent to the collection of geodesic boundary coordinates, geotagged
                photos, and tamper-evident audit logs in compliance with the{' '}
                <strong>Nigeria Data Protection Act (NDPA) 2023</strong>.
              </label>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold"
            >
              <span>Complete Registration</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <p className="text-center text-xs text-slate-400">
            Already registered?{' '}
            <Link to="/login" className="text-emerald-400 hover:underline font-semibold">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

