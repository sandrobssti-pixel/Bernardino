import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Logo } from '../components/Logo';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setSession(data.token, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Não foi possível entrar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="tech-grid relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-radial px-4">
      <div className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-1/4 h-72 w-72 rounded-full bg-accent-500/20 blur-3xl" />

      <form onSubmit={handleSubmit} className="glass relative w-full max-w-sm rounded-2xl p-8 shadow-card">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size="lg" />
          <h1 className="mt-4 font-display text-2xl font-semibold text-white">AtendeFlow</h1>
          <p className="text-sm text-slate-400">Entre para acessar sua central de atendimento</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-300">
            {error}
          </div>
        )}

        <label className="mb-3 block text-sm">
          <span className="mb-1.5 block text-xs font-medium text-slate-400">E-mail</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@empresa.com"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-brand-400/60 focus:ring-2 focus:ring-brand-400/20"
          />
        </label>
        <label className="mb-6 block text-sm">
          <span className="mb-1.5 block text-xs font-medium text-slate-400">Senha</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-brand-400/60 focus:ring-2 focus:ring-brand-400/20"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand-gradient py-2.5 font-medium text-white shadow-glow transition hover:opacity-90 disabled:opacity-60"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
        <p className="mt-5 text-center text-xs text-slate-500">
          Ainda não tem conta?{' '}
          <a href="/register" className="font-medium text-brand-300 hover:underline">
            Criar conta
          </a>
        </p>
      </form>
    </div>
  );
}
