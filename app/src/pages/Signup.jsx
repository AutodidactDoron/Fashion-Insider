import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const { data, error: err } = await supabase.auth.signUp({ email, password });
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      if (data.session) {
        navigate('/dashboard', { replace: true });
      } else {
        setSuccess('Account created! Check your email to confirm, or sign in below.');
      }
    } catch (err) {
      setError(err.message || 'Sign up failed');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">
            Fashion <span className="text-[#58a6ff]">Insider</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">Create your account</p>
        </div>

        <div className="bg-[rgba(22,27,34,0.9)] border border-white/10 rounded-xl p-6 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#58a6ff]"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#58a6ff]"
                placeholder="•••••••• (min 6 characters)"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            {success && <p className="text-[#2ea043] text-sm">{success}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-lg bg-[#58a6ff] hover:bg-[#79b8ff] text-black font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <div className="relative my-6">
            <span className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/10" />
            </span>
            <span className="relative flex justify-center text-xs text-gray-500 uppercase">
              Or continue with
            </span>
          </div>

          <button
            type="button"
            disabled
            className="w-full py-3 px-4 rounded-lg border border-white/20 text-gray-400 font-medium cursor-not-allowed opacity-75"
            title="Coming soon"
          >
            Sign up with Google (coming soon)
          </button>

          <p className="mt-6 text-center text-sm text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-[#58a6ff] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
