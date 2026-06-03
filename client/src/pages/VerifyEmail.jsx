import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { CheckCircle, Loader2, Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../hooks/useAuth';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();

  // Email comes from router state (Register) or the logged-in user
  const email = location.state?.email || user?.email || '';

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const [verified, setVerified] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const inputRefs = useRef([]);

  // Focus the first empty box on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Resend cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // ── Input handling ─────────────────────────────────────────────────────

  const handleDigitChange = (index, value) => {
    // Accept only digits; handle paste of full code
    const cleaned = value.replace(/\D/g, '');

    if (cleaned.length > 1) {
      // Pasted a multi-digit string — fill boxes left to right
      const next = [...digits];
      cleaned.split('').slice(0, 6).forEach((d, i) => {
        if (index + i < 6) next[index + i] = d;
      });
      setDigits(next);
      const lastFilled = Math.min(index + cleaned.length, 5);
      inputRefs.current[lastFilled]?.focus();
      return;
    }

    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);
    setError('');

    if (cleaned && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const otp = digits.join('');
    if (otp.length < 6) {
      setError('Please enter all 6 digits.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/verify-email', { email, otp });
      if (data.success) {
        updateUser(data.data.user);
        setVerified(true);
        setTimeout(() => navigate('/dashboard', { replace: true }), 2500);
      } else {
        setError(data.message || 'Verification failed.');
        setDigits(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Verification failed. Please try again.';
      setError(msg);
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit when all 6 digits are filled
  useEffect(() => {
    if (digits.every((d) => d !== '') && !loading && !verified) {
      handleSubmit();
    }
  }, [digits]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resend ─────────────────────────────────────────────────────────────

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setResendMsg('');
    setError('');
    try {
      const { data } = await api.post('/auth/send-verification', { email });
      setResendMsg(data.message || 'Code sent! Check your inbox.');
      setCooldown(60);
    } catch (err) {
      setResendMsg(err.response?.data?.message || 'Failed to resend. Please try again.');
    } finally {
      setResending(false);
    }
  };

  // ── Success screen ─────────────────────────────────────────────────────

  if (verified) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl shadow-lg p-10 text-center max-w-sm w-full">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Email verified!</h2>
            <p className="text-slate-500 text-sm">Redirecting you to your dashboard…</p>
            <Loader2 size={18} className="animate-spin text-slate-400 mx-auto mt-4" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ── Main verification form ─────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-lg border-t-4 border-[#1a5f3c] p-8">
            {/* Icon + heading */}
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-[#0d3b5c]/10 rounded-lg flex items-center justify-center shrink-0">
                <ShieldCheck size={20} className="text-[#0d3b5c]" />
              </div>
              <h1 className="text-2xl font-bold text-[#0d3b5c]">Verify your email</h1>
            </div>

            <p className="text-slate-500 text-sm mb-1">
              We sent a 6-digit code to
            </p>
            <p className="font-semibold text-slate-800 text-sm mb-6 flex items-center gap-1.5">
              <Mail size={14} className="text-[#0d3b5c]" />
              {email || 'your email address'}
            </p>

            {/* OTP input boxes */}
            <form onSubmit={handleSubmit}>
              <div className="flex justify-between gap-2 mb-5">
                {digits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => (inputRefs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={digit}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    className={`w-12 h-14 text-center text-2xl font-bold rounded-lg border-2 outline-none transition-colors
                      ${error
                        ? 'border-red-400 bg-red-50'
                        : digit
                          ? 'border-[#0d3b5c] bg-[#0d3b5c]/5'
                          : 'border-slate-300 focus:border-[#0d3b5c]'
                      }`}
                  />
                ))}
              </div>

              {error && (
                <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || digits.some((d) => !d)}
                className="w-full bg-[#0d3b5c] hover:bg-[#0a2d45] text-white font-semibold py-3 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin" /> Verifying…</>
                ) : (
                  'Verify email'
                )}
              </button>
            </form>

            {/* Resend */}
            <div className="mt-5 text-center">
              {resendMsg && (
                <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2 mb-3">
                  {resendMsg}
                </p>
              )}
              <p className="text-slate-500 text-sm">
                Didn&apos;t receive a code?{' '}
                <button
                  onClick={handleResend}
                  disabled={cooldown > 0 || resending}
                  className="text-[#0d3b5c] font-semibold hover:underline disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                >
                  {resending
                    ? <><Loader2 size={12} className="animate-spin" /> Sending…</>
                    : cooldown > 0
                      ? <><RefreshCw size={12} /> Resend in {cooldown}s</>
                      : 'Resend code'
                  }
                </button>
              </p>
            </div>

            <p className="mt-4 text-center text-xs text-slate-400">
              Code expires in 15 minutes.{' '}
              <Link to="/dashboard" className="hover:underline">Skip for now</Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
