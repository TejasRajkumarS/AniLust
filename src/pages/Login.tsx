import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { User } from '../types';
import { validateEmail } from '../utils/validation';
import { verifyPassword } from '../utils/auth';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const navigate = useNavigate();

  // Auto-fill email if previously saved
  useEffect(() => {
    const savedEmail = localStorage.getItem('anilust_saved_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // Real-time email validation
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setEmailError('');
    setError('');
  };

  const handleEmailBlur = () => {
    if (email) {
      const validation = validateEmail(email);
      if (!validation.isValid) {
        setEmailError(validation.message || '');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setEmailError('');

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      setEmailError(emailValidation.message || '');
      setLoading(false);
      return;
    }

    // Validate password
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    try {
      const users = JSON.parse(localStorage.getItem('anilust_users') || '[]');
      const user = users.find((u: any) => u.email === email);

      if (!user) {
        throw new Error('Invalid email or password');
      }

      // Verify password (accounts created before password hashing have no hash — force re-signup)
      if (!user.passwordHash || !verifyPassword(password, user.passwordHash)) {
        throw new Error('Invalid email or password');
      }

      // Save email if remember me is checked
      if (rememberMe) {
        localStorage.setItem('anilust_saved_email', email);
      } else {
        localStorage.removeItem('anilust_saved_email');
      }

      localStorage.setItem('anilust_current_user', JSON.stringify(user));
      onLogin(user);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-dark flex items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8 sm:mb-12">
          <Logo size="lg" className="mx-auto mb-4 sm:mb-6" />
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Welcome Back</h1>
          <p className="text-slate-500 mt-2 text-sm sm:text-base">Sign in to continue watching</p>
        </div>

        {/* Login Form */}
        <div className="bg-card-dark border border-white/10 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm animate-shake">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined !text-lg">error</span>
                  {error}
                </div>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-400 mb-2 uppercase tracking-widest">
                Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  onBlur={handleEmailBlur}
                  className={`w-full bg-white/5 border ${emailError ? 'border-red-500/50' : 'border-white/10'} rounded-xl px-4 py-3.5 sm:py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-primary focus:bg-white/10 outline-none transition-all text-base`}
                  placeholder="Enter your email"
                  autoComplete="email"
                  autoFocus
                  required
                />
                {email && !emailError && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 material-symbols-outlined !text-xl">
                    check_circle
                  </span>
                )}
              </div>
              {emailError && (
                <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                  <span className="material-symbols-outlined !text-sm">error</span>
                  {emailError}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-400 mb-2 uppercase tracking-widest">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 sm:py-3 pr-12 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-primary focus:bg-white/10 outline-none transition-all text-base"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1 focus:outline-none focus:ring-2 focus:ring-primary rounded"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <span className="material-symbols-outlined !text-xl">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 sm:w-5 sm:h-5 rounded border-white/20 bg-white/5 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-xs sm:text-sm text-slate-400 group-hover:text-white transition-colors">
                  Remember me
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !!emailError}
              className="w-full bg-primary hover:bg-primary/90 text-white font-black py-4 sm:py-4 rounded-xl transition-all active:scale-95 shadow-lg shadow-primary/20 uppercase tracking-widest text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[56px] sm:min-h-[auto]"
            >
              {loading ? (
                <>
                  <div className="animate-spin size-4 border-2 border-white/30 border-t-white rounded-full"></div>
                  Signing In...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined !text-xl">login</span>
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="mt-6 sm:mt-8 text-center">
            <p className="text-slate-500 text-sm">
              Don't have an account?{' '}
              <Link to="/signup" className="text-primary hover:text-primary/80 font-bold transition-colors">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
