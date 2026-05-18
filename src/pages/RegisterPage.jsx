import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('请填写所有字段');
      return;
    }
    if (username.length < 3) {
      setError('用户名至少3个字符');
      return;
    }
    if (password.length < 6) {
      setError('密码至少6个字符');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    try {
      await register(username, password);
      navigate('/dashboard/image');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-panel-bg/50 backdrop-blur-xl border border-border rounded-xl p-8 shadow-4xl animate-fade-in-up">
      <div className="space-y-5">
        <div>
          <label className="block text-xs font-bold text-white/40 mb-1.5 ml-1">用户名</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="请输入用户名（至少3个字符）"
            autoComplete="username"
            className="w-full bg-white/[0.03] border border-border rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/10 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30 transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-white/40 mb-1.5 ml-1">密码</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="请输入密码（至少6个字符）"
            autoComplete="new-password"
            className="w-full bg-white/[0.03] border border-border rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/10 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30 transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-white/40 mb-1.5 ml-1">确认密码</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="请再次输入密码"
            autoComplete="new-password"
            className="w-full bg-white/[0.03] border border-border rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/10 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30 transition-all"
          />
        </div>

        {error && (
          <div className="px-3 py-2 bg-red-500/5 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-xs font-medium">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-black font-semibold py-2.5 rounded-lg hover:bg-primary-hover disabled:opacity-50 transition-all active:scale-[0.98]"
        >
          {loading ? '注册中...' : '注 册'}
        </button>
      </div>

      <p className="text-center text-xs text-white/30 mt-6">
        已有账号？<Link to="/login" className="text-primary hover:text-primary-hover transition-colors font-medium">立即登录</Link>
      </p>
    </form>
  );
}
