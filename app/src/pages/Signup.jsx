import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState(''); 
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (username.length < 3) {
      setError('Username must be at least 3 characters long.');
      setLoading(false);
      return;
    }

    try {
      const { data, error: err } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: { user_name: username } 
        }
      });

      if (err) throw err;

      if (data.user) {
        const { error: profileErr } = await supabase.from('profiles').insert([
          { 
            id: data.user.id, 
            user_name: username,
            xp_points: 0,
            trust_score: 100.0
          }
        ]);

        if (profileErr) {
          if (profileErr.code === '23505') {
            throw new Error('This username is already taken. Please choose another.');
          }
          throw profileErr;
        }
      }

      if (data.session) {
        navigate('/dashboard', { replace: true });
      } else {
        setSuccess('Account created! Welcome to the inside. You can now sign in.');
      }
    } catch (err) {
      setError(err?.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-fi-dark">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">
            Fashion <span className="text-fi-accent">Insider</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">Create your trading identity</p>
        </div>

        <div className="bg-fi-surface border border-white/10 rounded-xl p-6 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">
                Username
              </label>
              <input
                id="username"
                type="text"
                required
                autoComplete="off"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} 
                className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-fi-accent focus:border-fi-accent transition-colors"
                placeholder="trader_99"
              />
            </div>

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
                className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-fi-accent focus:border-fi-accent transition-colors"
                placeholder="investor@example.com"
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
                className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-fi-accent focus:border-fi-accent transition-colors"
                placeholder="•••••••• (min 6 characters)"
              />
            </div>
            
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p role="alert" className="text-red-400 text-sm text-center font-medium">
                  {error}
                </p>
              </div>
            )}
            
            {success && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 mt-4">
                <p className="text-green-400 text-sm text-center font-medium">
                  {success}
                </p>
              </div>
            )}
            
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-lg bg-fi-accent hover:bg-blue-400 text-black font-black uppercase tracking-widest transition-colors disabled:opacity-50 mt-4"
            >
              {loading ? 'Authenticating...' : 'Enter the Market'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-400">
            Already have an identity?{' '}
            <Link to="/login" className="text-fi-accent hover:underline font-bold">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}