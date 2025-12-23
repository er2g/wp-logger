import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { loginStart, loginSuccess, loginFailure } from '../../store/slices/authSlice';
import apiClient from '../../services/api/ApiClient';
import { Lock, Loader2, Sparkles, ShieldCheck } from 'lucide-react';

const Login: React.FC = () => {
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isLoading, error } = useSelector((state: RootState) => state.auth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    dispatch(loginStart());
    try {
      const response = await apiClient.post<{
        success: boolean;
        data: {
          accessToken: string;
          expiresIn: string;
          user: {
            id: string;
            username: string;
          };
        };
        error?: string;
      }>('/auth/login/password', { password });

      if (response.success) {
        const { user, accessToken } = response.data;
        apiClient.setToken(accessToken);
        dispatch(loginSuccess({ user, accessToken }));
        navigate('/');
      } else {
        dispatch(loginFailure(response.error || 'Login failed'));
      }
    } catch (err: any) {
      dispatch(loginFailure(err.message || 'An error occurred during login'));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-violet-300/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-300/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-fuchsia-200/10 rounded-full blur-3xl" />
      </div>

      <div className="glass-panel rounded-[32px] w-full max-w-md p-10 animate-slide-up relative">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-xl shadow-violet-200/50 animate-pulse-soft">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold gradient-text mb-2">Welcome Back</h1>
          <p className="text-slate-500 text-sm">
            Enter your admin password to access the control center
          </p>
        </div>

        {/* Form */}
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wider text-violet-600"
            >
              Admin Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-violet-400" />
              <input
                id="password"
                name="password"
                type="password"
                required
                className="glass-input pl-12 !py-4 !rounded-2xl"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 flex items-center gap-2 animate-slide-up">
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full glass-button-solid !py-4 !rounded-2xl !text-base"
          >
            {isLoading ? (
              <Loader2 className="mx-auto h-6 w-6 animate-spin" />
            ) : (
              <>
                <Lock className="w-5 h-5 mr-2" />
                Access Control Center
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-slate-400">
            Secured with end-to-end encryption
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
