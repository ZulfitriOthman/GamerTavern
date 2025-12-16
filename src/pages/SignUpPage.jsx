// Sign Up Page - Fantasy Theme
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

function SignUpPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
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

  const validate = () => {
    const newErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = validate();

    if (Object.keys(newErrors).length === 0) {
      // Save to localStorage (in real app, this would be an API call)
      const users = JSON.parse(localStorage.getItem('tavern_users') || '[]');
      
      // Check if user already exists
      if (users.find(u => u.email === formData.email)) {
        setErrors({ email: 'Email already registered' });
        return;
      }

      users.push({
        id: Date.now(),
        username: formData.username,
        email: formData.email,
        password: formData.password, // In real app, this would be hashed
        createdAt: new Date().toISOString()
      });

      localStorage.setItem('tavern_users', JSON.stringify(users));
      localStorage.setItem('tavern_username', formData.username);
      localStorage.setItem('tavern_current_user', JSON.stringify({
        username: formData.username,
        email: formData.email
      }));

      alert('Account created successfully! ✨');
      navigate('/login');
    } else {
      setErrors(newErrors);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-900/30 bg-gradient-to-br from-slate-950 via-purple-950/40 to-slate-950 p-8 text-center shadow-2xl shadow-purple-900/20">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
        
        <span className="text-5xl mb-4 block">⚔️</span>
        <h1 className="font-serif text-3xl font-bold text-amber-100">
          Join the Tavern
        </h1>
        <p className="mt-2 font-serif text-sm italic text-amber-100/70">
          Create your account and start your collection
        </p>
        
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
      </div>

      {/* Sign Up Form */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-900/30 bg-gradient-to-br from-slate-950 to-purple-950/30 p-8 shadow-lg shadow-purple-900/20">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
        
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username */}
          <div>
            <label className="block font-serif text-sm font-semibold text-amber-100 mb-2">
              Username
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Enter your username"
              className={`w-full rounded-lg border ${
                errors.username ? 'border-red-500' : 'border-amber-900/30'
              } bg-slate-950 px-4 py-3 font-serif text-sm text-amber-100 placeholder-amber-100/40 focus:outline-none focus:ring-2 ${
                errors.username ? 'focus:ring-red-500' : 'focus:ring-amber-600'
              }`}
            />
            {errors.username && (
              <p className="mt-1 font-serif text-xs text-red-400">{errors.username}</p>
            )}
          </div>

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

          {/* Confirm Password */}
          <div>
            <label className="block font-serif text-sm font-semibold text-amber-100 mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm your password"
              className={`w-full rounded-lg border ${
                errors.confirmPassword ? 'border-red-500' : 'border-amber-900/30'
              } bg-slate-950 px-4 py-3 font-serif text-sm text-amber-100 placeholder-amber-100/40 focus:outline-none focus:ring-2 ${
                errors.confirmPassword ? 'focus:ring-red-500' : 'focus:ring-amber-600'
              }`}
            />
            {errors.confirmPassword && (
              <p className="mt-1 font-serif text-xs text-red-400">{errors.confirmPassword}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full rounded-xl border border-amber-600/50 bg-gradient-to-r from-amber-950/50 to-purple-950/50 py-3 font-serif text-base font-bold text-amber-100 shadow-lg shadow-amber-900/30 transition-all hover:border-amber-500 hover:shadow-xl hover:shadow-amber-500/40"
          >
            Create Account
          </button>
        </form>

        {/* Login Link */}
        <div className="mt-6 text-center">
          <p className="font-serif text-sm text-amber-100/70">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-semibold text-amber-400 transition-colors hover:text-amber-300"
            >
              Sign In
            </Link>
          </p>
        </div>

        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
      </div>
    </div>
  );
}

export default SignUpPage;
