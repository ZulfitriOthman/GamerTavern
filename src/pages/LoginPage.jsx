// Login Page - Fantasy Theme
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

function LoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    if (Object.keys(newErrors).length === 0) {
      // Demo user for testing
      const demoUser = {
        email: 'demo@gamertavern.com',
        password: 'demo123',
        username: 'DemoHero'
      };

      // Check credentials (in real app, this would be an API call)
      const users = JSON.parse(localStorage.getItem('tavern_users') || '[]');
      let user = users.find(
        u => u.email === formData.email && u.password === formData.password
      );

      // Allow demo login
      if (!user && formData.email === demoUser.email && formData.password === demoUser.password) {
        user = demoUser;
      }

      if (user) {
        localStorage.setItem('tavern_username', user.username);
        localStorage.setItem('tavern_current_user', JSON.stringify({
          username: user.username,
          email: user.email
        }));
        alert(`Welcome back, ${user.username}! ✨`);
        navigate('/shop');
      } else {
        setErrors({ email: 'Invalid email or password' });
      }
    } else {
      setErrors(newErrors);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-900/30 bg-gradient-to-br from-slate-950 via-purple-950/40 to-slate-950 p-8 text-center shadow-2xl shadow-purple-900/20">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
        
        <span className="text-5xl mb-4 block">🏰</span>
        <h1 className="font-serif text-3xl font-bold text-amber-100">
          Welcome Back
        </h1>
        <p className="mt-2 font-serif text-sm italic text-amber-100/70">
          Sign in to continue your journey
        </p>
        
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
      </div>

      {/* Login Form */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-900/30 bg-gradient-to-br from-slate-950 to-purple-950/30 p-8 shadow-lg shadow-purple-900/20">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
        
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div>
            <label className="block font-serif text-sm font-semibold text-amber-100 mb-2">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              className={`w-full rounded-lg border ${
                errors.email ? 'border-red-500' : 'border-amber-900/30'
              } bg-slate-950 px-4 py-3 font-serif text-sm text-amber-100 placeholder-amber-100/40 focus:outline-none focus:ring-2 ${
                errors.email ? 'focus:ring-red-500' : 'focus:ring-amber-600'
              }`}
            />
            {errors.email && (
              <p className="mt-1 font-serif text-xs text-red-400">{errors.email}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block font-serif text-sm font-semibold text-amber-100 mb-2">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              className={`w-full rounded-lg border ${
                errors.password ? 'border-red-500' : 'border-amber-900/30'
              } bg-slate-950 px-4 py-3 font-serif text-sm text-amber-100 placeholder-amber-100/40 focus:outline-none focus:ring-2 ${
                errors.password ? 'focus:ring-red-500' : 'focus:ring-amber-600'
              }`}
            />
            {errors.password && (
              <p className="mt-1 font-serif text-xs text-red-400">{errors.password}</p>
            )}
          </div>

          {/* Forgot Password Link */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="rounded border-amber-900/30 bg-slate-950 text-amber-600 focus:ring-amber-600"
              />
              <span className="font-serif text-xs text-amber-100/70">Remember me</span>
            </label>
            <Link
              to="/forgot-password"
              className="font-serif text-xs text-amber-400 transition-colors hover:text-amber-300"
            >
              Forgot password?
            </Link>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full rounded-xl border border-amber-600/50 bg-gradient-to-r from-amber-950/50 to-purple-950/50 py-3 font-serif text-base font-bold text-amber-100 shadow-lg shadow-amber-900/30 transition-all hover:border-amber-500 hover:shadow-xl hover:shadow-amber-500/40"
          >
            Sign In
          </button>
        </form>

        {/* Sign Up Link */}
        <div className="mt-6 text-center">
          <p className="font-serif text-sm text-amber-100/70">
            Don't have an account?{' '}
            <Link
              to="/signup"
              className="font-semibold text-amber-400 transition-colors hover:text-amber-300"
            >
              Create Account
            </Link>
          </p>
        </div>

        {/* Demo Credentials */}
        <div className="mt-6 rounded-lg border border-amber-900/20 bg-slate-950/50 p-4">
          <p className="font-serif text-xs font-semibold text-amber-100/60 mb-2">
            💡 Demo Credentials:
          </p>
          <p className="font-serif text-xs text-amber-100/50">
            Email: demo@gamertavern.com<br />
            Password: demo123
          </p>
        </div>

        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
      </div>
    </div>
  );
}

export default LoginPage;
