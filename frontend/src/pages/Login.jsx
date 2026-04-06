import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { Cpu, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function Login() {
  const { login, user, loading } = useAuth();
  const [form, setForm] = useState({ email: 'admin@iqac.edu', password: 'Admin@123' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');

  if (user) return <Navigate to="/dashboard" replace />;

  const handle = async (e) => {
    e.preventDefault();
    setError('');
    const result = await login(form.email, form.password);
    if (!result.success) setError(result.message);
  };

  const DEMO_ACCOUNTS = [
    { label: 'Admin', email: 'admin@iqac.edu', password: 'Admin@123' },
    { label: 'HOD CSE', email: 'hod.cse@iqac.edu', password: 'Hod@123' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface relative overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 bg-grid-pattern opacity-30" />
      {/* Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-sm mx-4">
        {/* Card */}
        <div className="card p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-brand-500 flex items-center justify-center mb-3 shadow-lg shadow-brand-500/30">
              <Cpu size={22} className="text-white" />
            </div>
            <h1 className="font-display font-bold text-xl text-white">IQAC System</h1>
            <p className="text-xs text-slate-500 mt-1">Internal Quality Assurance Cell</p>
          </div>

          {/* Form */}
          <form onSubmit={handle} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1.5">Email</label>
              <input
                type="email"
                className="input"
                placeholder="admin@iqac.edu"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <button type="submit" className="btn-primary w-full h-10 flex items-center justify-center gap-2 mt-2" disabled={loading}>
              {loading ? <Loader2 size={15} className="animate-spin" /> : null}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-5 pt-5 border-t border-[#1e2738]">
            <p className="text-xs text-slate-500 mb-2 text-center">Quick demo access</p>
            <div className="flex gap-2">
              {DEMO_ACCOUNTS.map(acc => (
                <button
                  key={acc.label}
                  onClick={() => setForm({ email: acc.email, password: acc.password })}
                  className="flex-1 text-xs py-2 rounded-lg border border-[#1e2738] hover:border-brand-500/40 hover:bg-brand-500/5 text-slate-400 hover:text-brand-400 transition-all"
                >
                  {acc.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-4">
          NAAC / NBA Monitoring Platform · v1.0
        </p>
      </div>
    </div>
  );
}
