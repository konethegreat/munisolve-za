import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../hooks/useAuth';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, googleLogin } = useAuth();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError('');
    try {
      await googleLogin(credentialResponse.credential);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Google sign-in failed. Please try again.');
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
            <p className="text-slate-600 text-sm mb-6">Sign in to your MuniSolve ZA account.</p>

            {/* Google Sign-In */}
            <div className="flex justify-center mb-5">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google sign-in failed. Please try again.')}
                useOneTap
                theme="filled_blue"
                shape="pill"
                text="signin_with"
                width="350"
              />
            </div>

            {/* Divider */}
            <div className="relative mb-5">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200"></span>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-slate-400 font-medium tracking-wide">
                  Or continue with email
                </span>
              </div>
            </div>

            {/* Email / password form */}
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
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-[#0d3b5c] focus:ring-1 focus:ring-[#0d3b5c] outline-none text-slate-900"
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
                  className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-[#0d3b5c] focus:ring-1 focus:ring-[#0d3b5c] outline-none text-slate-900"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0d3b5c] hover:bg-[#0a2d45] text-white font-semibold py-3 px-4 rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing in…' : 'Log in'}
              </button>
            </form>

            <p className="mt-6 text-center text-slate-600 text-sm">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="text-[#0d3b5c] font-medium hover:underline">
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
