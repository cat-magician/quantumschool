import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import StudentDashboard from './StudentDashboard';
import AdminDashboard from './AdminDashboard';
import TeacherApplicationGate from './TeacherApplicationGate';

export default function Dashboard() {
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate('/');
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900/80 border border-white/10 rounded-2xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Профиль не загружен</h2>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            Вход выполнен ({user.email}), но профиль в базе не найден.
            Возможно, не применены миграции Supabase.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={refreshProfile}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Повторить
            </button>
            <button
              onClick={signOut}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Выйти
            </button>
            <Link to="/" className="text-sm text-slate-500 hover:text-slate-300">На главную</Link>
          </div>
        </div>
      </div>
    );
  }

  const role = profile.role ?? 'student';

  if (profile.teacher_application_rejected && role === 'student') {
    return <TeacherApplicationGate mode="rejected" />;
  }

  if (profile.teacher_application && role === 'student') {
    return <TeacherApplicationGate mode="pending" />;
  }

  if (role === 'superadmin' || role === 'admin') {
    return <AdminDashboard isSuperAdmin={role === 'superadmin'} />;
  }

  return <StudentDashboard />;
}
