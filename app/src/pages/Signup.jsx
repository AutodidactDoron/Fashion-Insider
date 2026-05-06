import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState(''); // הוספת שדה הזהות
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // 1. אימות בסיסי ב-Frontend למניעת קריאות שרת מיותרות
    if (username.length < 3) {
      setError('Username must be at least 3 characters long.');
      setLoading(false);
      return;
    }

    try {
      // 2. יצירת המשתמש במערכת האותנטיקציה של Supabase
      const { data, error: err } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: { user_name: username } // שמירת השם ב-Metadata
        }
      });

      if (err) throw err;

      // 3. הזרקת המשתמש החדש לטבלת הפרופילים שלנו (The Business Logic)
      if (data.user) {
        const { error: profileErr } = await supabase.from('profiles').insert([
          { 
            id: data.user.id, // קישור קשיח ל-ID המאובטח
            user_name: username,
            xp_points: 0,
            trust_score: 100.0
          }
        ]);

        if (profileErr) {
          // מנגנון הגנה: אם השם תפוס, הטבלה תזרוק שגיאה כי הגדרנו UNIQUE
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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">
            Fashion <span className="text-[#58a6ff]">Insider</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">Create your trading identity</p>
        </div>

        <div className="bg-[rgba(22,27,34,0.9)] border border-white/10 rounded-xl p-6 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* --- השדה החדש: Username --- */}
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
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} // מניעת רווחים ותווים מיוחדים
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#58a6ff]"
                placeholder="HighStakesFounder"
              />
            </div>
            {/* --------------------------- */}

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
            
            {error && (
              <p role="alert" className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            {success && <p className="text-[#2ea043] text-sm font-bold bg-[#2ea043]/10 border border-[#2ea043]/30 rounded-lg px-3 py-2">{success}</p>}
            
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-lg bg-[#58a6ff] hover:bg-[#79b8ff] text-black font-black uppercase tracking-widest transition-colors disabled:opacity-50 mt-4"
            >
              {loading ? 'Authenticating...' : 'Enter the Market'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-400">
            Already have an identity?{' '}
            <Link to="/login" className="text-[#58a6ff] hover:underline font-bold">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}