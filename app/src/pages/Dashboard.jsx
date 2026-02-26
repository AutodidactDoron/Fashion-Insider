import { Link } from 'react-router-dom';

export default function Dashboard() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Welcome to Fashion Insider</h1>
        <p className="text-gray-400 mb-4">You are signed in.</p>
        <Link to="/login" className="text-[#58a6ff] hover:underline">Back to Login</Link>
      </div>
    </div>
  );
}
