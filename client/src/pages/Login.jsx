// ==========================================
// LOGIN PAGE (Updated with AuthContext)
// ==========================================
import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Get the page they were trying to access (if redirected here)
  const from = location.state?.from?.pathname || '/dashboard';

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await login(form.email, form.password);
      // Redirect to where they were going, or dashboard
      navigate(from, { replace: true });
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Login failed. Please check your email and password.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-lg border-t-4 border-[#0d3b5c] p-8">
            <h1 className="text-2xl font-bold text-[#0d3b5c] mb-2">Log in</h1>
            <p className="text-slate-600 text-sm mb-6">
              Sign in to your MuniSolve ZA account.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {error}
                </p>
              )}
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-[#0d3b5c] focus:ring-1 focus:ring-[#0d3b5c] outline-none"
                  placeholder="you@example.com"
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={form.password}
                  onChange={handleChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-[#0d3b5c] focus:ring-1 focus:ring-[#0d3b5c] outline-none"
                  placeholder="••••••••"
                />
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0d3b5c] hover:bg-[#0a2d45] text-white font-semibold py-3 px-4 rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing in...' : 'Log in'}
              </button>
            </form>

            <p className="mt-6 text-center text-slate-600 text-sm">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="text-[#0d3b5c] font-medium hover:text-[#1a5f3c]">
                Register
              </Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
