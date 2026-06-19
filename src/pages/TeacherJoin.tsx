import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Atom, Eye, EyeOff, GraduationCap, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

export default function TeacherJoin() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signUp(email, password, name);
    if (result.error) {
      setLoading(false);
      setError(result.error);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('user_profiles').update({
        teacher_application: true,
        teacher_application_rejected: false,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id);
    }

    setLoading(false);
    setDone(true);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-white/10 rounded-3xl p-8 text-center">
          <GraduationCap className="w-12 h-12 text-blue-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Заявка отправлена</h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            Суперадмин одобрит заявку и назначит вас в учебную группу. После этого войдите в личный кабинет — откроются разделы «Ученики» и «Домашние задания».
          </p>
          <Link to="/dashboard" className="inline-flex items-center justify-center w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold mb-3">
            Войти в кабинет
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-white/10 rounded-3xl p-8">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-violet-700 rounded-2xl flex items-center justify-center">
            <Atom className="w-7 h-7 text-white" />
          </div>
        </div>
        <h1 className="text-xl font-bold text-white text-center mb-1">Регистрация преподавателя</h1>
        <p className="text-slate-400 text-sm text-center mb-8">
          Для школьников —{' '}
          <Link to="/#contact" className="text-blue-400 hover:text-blue-300">форма заявки на главной</Link>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">ФИО</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Пароль</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-violet-700 text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Подать заявку
          </button>
        </form>
        <p className="text-center mt-6 text-sm text-slate-500">
          Уже есть доступ?{' '}
          <button type="button" onClick={() => navigate('/dashboard')} className="text-blue-400 hover:text-blue-300">
            Войти в кабинет
          </button>
        </p>
      </div>
    </div>
  );
}
