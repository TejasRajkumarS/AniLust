import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { User } from '../types';
import { validateEmail, validateUsername, validatePassword, validateConfirmPassword, getPasswordStrength } from '../utils/validation';
import { authService } from '../services/authService';

interface SignupProps {
  onLogin: (user: User) => void;
}

const Signup: React.FC<SignupProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const navigate = useNavigate();

  const passwordStrength = password ? getPasswordStrength(password) : null;

  // Real-time validation handlers
  const handleUsernameBlur = () => {
    if (username) {
      const validation = validateUsername(username);
      setFieldErrors(prev => ({ ...prev, username: validation.isValid ? '' : validation.message || '' }));
    }
  };

  const handleEmailBlur = () => {
    if (email) {
      const validation = validateEmail(email);
      setFieldErrors(prev => ({ ...prev, email: validation.isValid ? '' : validation.message || '' }));
    }
  };

  const handlePasswordBlur = () => {
    if (password) {
      const validation = validatePassword(password);
      setFieldErrors(prev => ({ ...prev, password: validation.isValid ? '' : validation.message || '' }));
    }
  };

  const handleConfirmPasswordBlur = () => {
    if (confirmPassword) {
      const validation = validateConfirmPassword(password, confirmPassword);
      setFieldErrors(prev => ({ ...prev, confirmPassword: validation.isValid ? '' : validation.message || '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate all fields
    const usernameValidation = validateUsername(username);
    const emailValidation = validateEmail(email);
    const passwordValidation = validatePassword(password);
    const confirmPasswordValidation = validateConfirmPassword(password, confirmPassword);

    const errors = {
      username: usernameValidation.isValid ? '' : usernameValidation.message || '',
      email: emailValidation.isValid ? '' : emailValidation.message || '',
      password: passwordValidation.isValid ? '' : passwordValidation.message || '',
      confirmPassword: confirmPasswordValidation.isValid ? '' : confirmPasswordValidation.message || ''
    };

    setFieldErrors(errors);

    if (Object.values(errors).some(err => err !== '')) {
      setLoading(false);
      return;
    }

    try {
      const response = await authService.signup({ username, email, password });

      if (response.user) {
        onLogin(response.user as User);
      }
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const getStrengthColor = () => {
    if (!passwordStrength) return '';
    switch (passwordStrength) {
      case 'weak': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'strong': return 'bg-green-500';
    }
  };

  const getStrengthWidth = () => {
    if (!passwordStrength) return '0%';
    switch (passwordStrength) {
      case 'weak': return '33%';
      case 'medium': return '66%';
      case 'strong': return '100%';
    }
  };

  return (
    <div className="min-h-screen bg-background-dark flex items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8 sm:mb-12">
          <Logo size="lg" className="mx-auto mb-4 sm:mb-6" />
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Join Anilust</h1>
          <p className="text-slate-500 mt-2 text-sm sm:text-base">Create your account to start watching</p>
        </div>

        {/* Signup Form */}
        <div className="bg-card-dark border border-white/10 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm animate-shake">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined !text-lg">error</span>
                  {error}
                </div>
              </div>
            )}

            {/* Username Field */}
            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-400 mb-2 uppercase tracking-widest">
                Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setFieldErrors(prev => ({ ...prev, username: '' }));
                  }}
                  onBlur={handleUsernameBlur}
                  className={`w-full bg-white/5 border ${fieldErrors.username ? 'border-red-500/50' : 'border-white/10'} rounded-xl px-4 py-3.5 sm:py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-primary focus:bg-white/10 outline-none transition-all text-base`}
                  placeholder="Choose a username"
                  autoComplete="username"
                  autoFocus
                  required
                />
                {username && !fieldErrors.username && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 material-symbols-outlined !text-xl">
                    check_circle
                  </span>
                )}
              </div>
              {fieldErrors.username && (
                <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                  <span className="material-symbols-outlined !text-sm">error</span>
                  {fieldErrors.username}
                </p>
              )}
            </div>

            {/* Email Field */}
            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-400 mb-2 uppercase tracking-widest">
                Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setFieldErrors(prev => ({ ...prev, email: '' }));
                  }}
                  onBlur={handleEmailBlur}
                  className={`w-full bg-white/5 border ${fieldErrors.email ? 'border-red-500/50' : 'border-white/10'} rounded-xl px-4 py-3.5 sm:py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-primary focus:bg-white/10 outline-none transition-all text-base`}
                  placeholder="Enter your email"
                  autoComplete="email"
                  required
                />
                {email && !fieldErrors.email && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 material-symbols-outlined !text-xl">
                    check_circle
                  </span>
                )}
              </div>
              {fieldErrors.email && (
                <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                  <span className="material-symbols-outlined !text-sm">error</span>
                  {fieldErrors.email}
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
                    setFieldErrors(prev => ({ ...prev, password: '' }));
                  }}
                  onBlur={handlePasswordBlur}
                  className={`w-full bg-white/5 border ${fieldErrors.password ? 'border-red-500/50' : 'border-white/10'} rounded-xl px-4 py-3.5 sm:py-3 pr-12 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-primary focus:bg-white/10 outline-none transition-all text-base`}
                  placeholder="Create a password"
                  autoComplete="new-password"
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
              {fieldErrors.password && (
                <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                  <span className="material-symbols-outlined !text-sm">error</span>
                  {fieldErrors.password}
                </p>
              )}
              {/* Password Strength Indicator */}
              {password && !fieldErrors.password && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-400">Password Strength</span>
                    <span className={`text-xs font-bold ${passwordStrength === 'weak' ? 'text-red-400' : passwordStrength === 'medium' ? 'text-yellow-400' : 'text-green-400'}`}>
                      {passwordStrength?.toUpperCase()}
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${getStrengthColor()}`}
                      style={{ width: getStrengthWidth() }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-400 mb-2 uppercase tracking-widest">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setFieldErrors(prev => ({ ...prev, confirmPassword: '' }));
                  }}
                  onBlur={handleConfirmPasswordBlur}
                  className={`w-full bg-white/5 border ${fieldErrors.confirmPassword ? 'border-red-500/50' : 'border-white/10'} rounded-xl px-4 py-3.5 sm:py-3 pr-12 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-primary focus:bg-white/10 outline-none transition-all text-base`}
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1 focus:outline-none focus:ring-2 focus:ring-primary rounded"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  <span className="material-symbols-outlined !text-xl">
                    {showConfirmPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                  <span className="material-symbols-outlined !text-sm">error</span>
                  {fieldErrors.confirmPassword}
                </p>
              )}
              {confirmPassword && !fieldErrors.confirmPassword && password === confirmPassword && (
                <p className="text-green-400 text-xs mt-1.5 flex items-center gap-1">
                  <span className="material-symbols-outlined !text-sm">check_circle</span>
                  Passwords match
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || Object.values(fieldErrors).some(err => err !== '')}
              className="w-full bg-primary hover:bg-primary/90 text-white font-black py-4 sm:py-4 rounded-xl transition-all active:scale-95 shadow-lg shadow-primary/20 uppercase tracking-widest text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[56px] sm:min-h-[auto] mt-6"
            >
              {loading ? (
                <>
                  <div className="animate-spin size-4 border-2 border-white/30 border-t-white rounded-full"></div>
                  Creating Account...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined !text-xl">person_add</span>
                  Create Account
                </>
              )}
            </button>
          </form>

          <div className="mt-6 sm:mt-8 text-center">
            <p className="text-slate-500 text-sm">
              Already have an account?{' '}
              <Link to="/login" className="text-primary hover:text-primary/80 font-bold transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;