import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { loginStart, loginSuccess, loginFailure } from '../../store/slices/authSlice';
import webAuthnClient from '../../services/auth/WebAuthnClient';
import apiClient from '../../services/api/ApiClient';
import { User, Loader2 } from 'lucide-react';

const Register: React.FC = () => {
  const [username, setUsername] = useState('');
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isLoading, error } = useSelector((state: RootState) => state.auth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    dispatch(loginStart());
    try {
      const response = await webAuthnClient.register(username);
      
      if (response.success) {
        const { user, accessToken } = response.data;
        apiClient.setToken(accessToken);
        dispatch(loginSuccess({ user, accessToken }));
        navigate('/');
      } else {
        dispatch(loginFailure('Registration failed'));
      }
    } catch (err: any) {
      dispatch(loginFailure(err.message || 'An error occurred during registration'));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="glass-panel rounded-[28px] w-full max-w-lg p-10">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-600">Onboarding</p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-900">
            Create a new account
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Or{' '}
            <Link to="/login" className="font-semibold text-emerald-600 hover:text-emerald-700">
              sign in to existing account
            </Link>
          </p>
        </div>
        <form className="mt-10 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="username" className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              Username
            </label>
            <div className="relative mt-2">
              <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
              <input
                id="username"
                name="username"
                type="text"
                required
                className="w-full rounded-2xl border border-white/70 bg-white/70 px-11 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : 'Register with Passkey'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Register;
