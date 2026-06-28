import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useAuth } from './lib/AuthContext';
import { Instructor } from './lib/types';
import { DEFAULT_LANDING_CONFIG, fetchLandingConfig } from './lib/landingConfig';
import AuthModal from './components/AuthModal';
import PrivacyConsent from './components/PrivacyConsent';
import QuantumBrandTitle from './components/QuantumBrandTitle';
import HeroQuantumDecor from './components/HeroQuantumDecor';
import HeroBadgePill from './components/HeroBadgePill';
import LessonCoverImage from './components/LessonCoverImage';
import InstructorCardPreview from './components/InstructorCardPreview';
import { PRIVACY_POLICY_VERSION } from './lib/privacy';
import {
  getApplicationSuggestions,
  rememberApplicationValues,
} from './lib/applicationDraft';
import {
  Atom,
  GraduationCap,
  Users,
  Award,
  ChevronRight,
  Mail,
  MapPin,
  Menu,
  X,
  BarChart3,
  Send,
  CheckCircle,
  LogIn,
  Calendar,
  UserPlus,
  Eye,
  EyeOff,
  Handshake,
} from 'lucide-react';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TeacherJoin = lazy(() => import('./pages/TeacherJoin'));

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
}


function App() {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [heroBadgeText, setHeroBadgeText] = useState(DEFAULT_LANDING_CONFIG.hero_badge_text);
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [instructorsRes, landingConfig] = await Promise.all([
        supabase.from('instructors').select('*').order('sort_order'),
        fetchLandingConfig(),
      ]);

      if (instructorsRes.data) setInstructors(instructorsRes.data);
      setHeroBadgeText(landingConfig.hero_badge_text);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const [showAuth, setShowAuth] = useState(false);

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/join/teacher" element={<TeacherJoin />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="*" element={
          <div className="min-h-screen bg-slate-50">

            <Header isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} onLoginClick={() => setShowAuth(true)} />
            <Hero onLoginClick={() => setShowAuth(true)} heroBadgeText={heroBadgeText} />

            <Partners />
            <Timeline />
            <About />
            <Features />
            <Instructors instructors={instructors} loading={loading} />
            <ApplicationForm />
            <Footer />
            {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
          </div>
        } />
      </Routes>
    </Suspense>
  );
}

function Header({
  isMenuOpen,
  setIsMenuOpen,
  onLoginClick,
}: {
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
  onLoginClick: () => void;
}) {
  const { user, signOut } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const actionBase =
    'inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-200';
  const actionGhost = scrolled
    ? `${actionBase} text-slate-600 hover:text-slate-900 hover:bg-slate-100`
    : `${actionBase} text-white/85 hover:text-white hover:bg-white/10`;
  const actionOutline = scrolled
    ? `${actionBase} border border-slate-200 text-slate-700 hover:border-blue-400 hover:text-blue-700`
    : `${actionBase} border border-white/25 text-white hover:border-white/45 hover:bg-white/5`;
  const actionPrimary = `${actionBase} bg-gradient-to-r from-blue-600 to-purple-700 text-white shadow-sm hover:opacity-90`;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/95 backdrop-blur-md shadow-lg' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <a href="#home" className="flex items-center gap-3 group">
            <img src="/logo_qc.svg" alt="Квантовый кружок" className={`w-10 h-10 transform group-hover:rotate-12 transition-all duration-300 ${scrolled ? '' : 'brightness-0 invert'}`} />
            <span className={`text-xl font-bold transition-colors ${scrolled ? 'text-slate-900' : 'text-white'}`}>
              Квантовый кружок
            </span>
          </a>

          <nav className="hidden lg:flex items-center gap-8">
            {[
              { name: 'Главная', href: '#home' },
              { name: 'О нас', href: '#about' },
              { name: 'Преподаватели', href: '#instructors' },
              { name: 'Контакты', href: '#contact' },
            ].map((item) => (
              <a
                key={item.name}
                href={item.href}
                className={`text-sm font-medium transition-colors hover:text-cyan-500 ${
                  scrolled ? 'text-slate-700' : 'text-white/90'
                }`}
              >
                {item.name}
              </a>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-2">
            <a href="/join/teacher" className={actionGhost}>
              Для преподавателей
            </a>
            {user ? (
              <>
                <a href="/dashboard" className={actionOutline}>
                  <LogIn className="w-4 h-4 shrink-0" />
                  Кабинет
                </a>
                <button type="button" onClick={signOut} className={actionGhost}>
                  Выйти
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={onLoginClick} className={actionOutline}>
                  <LogIn className="w-4 h-4 shrink-0" />
                  Войти
                </button>
                <a href="#contact" className={actionPrimary}>
                  Записаться
                </a>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden w-11 h-11 rounded-xl flex items-center justify-center hover:bg-black/5"
            aria-label={isMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
          >
            {isMenuOpen ? (
              <X className={`w-6 h-6 ${scrolled ? 'text-slate-900' : 'text-white'}`} />
            ) : (
              <Menu className={`w-6 h-6 ${scrolled ? 'text-slate-900' : 'text-white'}`} />
            )}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="lg:hidden bg-white border-t">
          <div className="px-4 py-6 space-y-4">
            {[
              { name: 'Главная', href: '#home' },
              { name: 'О нас', href: '#about' },
              { name: 'Преподаватели', href: '#instructors' },
              { name: 'Контакты', href: '#contact' },
            ].map((item) => (
              <a
                key={item.name}
                href={item.href}
                onClick={() => setIsMenuOpen(false)}
                className="block text-slate-700 hover:text-cyan-600 font-medium py-2"
              >
                {item.name}
              </a>
            ))}
            <a
              href="/join/teacher"
              onClick={() => setIsMenuOpen(false)}
              className="block w-full text-center h-11 leading-[2.75rem] rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm"
            >
              Для преподавателей
            </a>
            <a
              href="#contact"
              onClick={() => setIsMenuOpen(false)}
              className="block w-full text-center h-11 leading-[2.75rem] rounded-xl bg-gradient-to-r from-blue-600 to-purple-700 text-white font-semibold text-sm"
            >
              Записаться
            </a>
            <div className="pt-4 border-t border-slate-100 space-y-2">
              {user ? (
                <>
                  <a
                    href="/dashboard"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center justify-center gap-2 w-full h-11 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm"
                  >
                    <LogIn className="w-4 h-4 shrink-0" />
                    Личный кабинет
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      signOut();
                      setIsMenuOpen(false);
                    }}
                    className="block w-full h-11 rounded-xl text-slate-600 font-medium text-sm hover:text-slate-900"
                  >
                    Выйти
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onLoginClick();
                    setIsMenuOpen(false);
                  }}
                  className="flex items-center justify-center gap-2 w-full h-11 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm"
                >
                  <LogIn className="w-4 h-4 shrink-0" />
                  Войти
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function Hero({ onLoginClick, heroBadgeText }: { onLoginClick: () => void; heroBadgeText: string }) {
  const { user } = useAuth();
  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950"
    >
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] bg-blue-500/15 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/3 right-1/3 w-[500px] h-[500px] bg-purple-500/15 rounded-full blur-3xl animate-pulse-slow delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-radial from-blue-900/30 to-transparent rounded-full" />

        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-20 w-2 h-2 bg-blue-400 rounded-full animate-float" />
          <div className="absolute top-48 left-[8%] w-1.5 h-1.5 bg-cyan-400 rounded-full animate-float delay-500" />
          <div className="absolute top-40 right-40 w-3 h-3 bg-purple-400 rounded-full animate-float delay-500" />
          <div className="absolute bottom-40 left-[6%] w-2 h-2 bg-violet-300 rounded-full animate-float delay-1000" />
          <div className="absolute bottom-20 right-20 w-4 h-4 bg-blue-300 rounded-full animate-float delay-1500" />
          <div className="absolute top-1/3 right-1/4 w-1 h-1 bg-purple-300 rounded-full animate-float" />
          <div className="absolute bottom-[32%] left-[14%] w-1 h-1 bg-blue-300 rounded-full animate-float delay-700" />
        </div>

        <div className="absolute top-1/3 left-10 w-48 h-48 opacity-50">
          <div className="relative w-full h-full animate-spin" style={{ animationDuration: '8s' }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-400 rounded-full" />
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-purple-400 rounded-full" />
            <div className="absolute top-1/2 right-0 w-2 h-2 bg-violet-400 rounded-full" />
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" fill="none" stroke="url(#gradient2)" strokeWidth="0.5" opacity="0.4">
              <defs>
                <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#7c3aed" />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r="30" />
              <circle cx="50" cy="50" r="20" />
              <circle cx="50" cy="50" r="10" />
              <line x1="50" y1="20" x2="50" y2="80" />
              <line x1="20" y1="50" x2="80" y2="50" />
            </svg>
          </div>
        </div>

        <HeroQuantumDecor />

        <div className="absolute bottom-0 right-0 w-[160px] sm:w-[280px] md:w-[340px] lg:w-[420px] h-auto opacity-95 animate-bounce pointer-events-none max-sm:opacity-70" style={{ animationDuration: '4s' }}>
          <img src="/image.svg" alt="Quantum Cat" className="w-full h-auto" loading="lazy" decoding="async" />
        </div>
        <div className="absolute bottom-6 right-28 md:right-44 text-sm text-blue-300 opacity-70 font-medium hidden sm:block pointer-events-none">
          запутан в квантах
        </div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center">
        <HeroBadgePill text={heroBadgeText} className="mb-8 animate-fade-in mx-auto" />

        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-2 leading-tight animate-slide-up">
          <span className="sr-only">Квантовый кружок — </span>
          Онлайн-школа МФТИ и РКЦ
          <br />
          <span className="text-gradient">
            по квантовым технологиям
          </span>
        </h1>

        <QuantumBrandTitle />

        <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-12 leading-relaxed animate-fade-in">
          Первая в России онлайн-школа по квантовым технологиям и смежным областям для школьников 9–11 классов
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <a
            href="#contact"
            className="group px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-700 text-white font-semibold text-lg rounded-2xl hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            Поступить на курс
            <ChevronRight className="w-5 h-5" />
          </a>
          {user ? (
            <a
              href="/dashboard"
              className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white font-semibold text-lg rounded-2xl border border-white/20 hover:bg-white/20 transition-all duration-300 flex items-center gap-2"
            >
              <LogIn className="w-5 h-5" /> Личный кабинет
            </a>
          ) : (
            <button
              onClick={onLoginClick}
              className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white font-semibold text-lg rounded-2xl border border-white/20 hover:bg-white/20 transition-all duration-300 flex items-center gap-2"
            >
              <LogIn className="w-5 h-5" /> Войти
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8 max-w-2xl mx-auto">
          <div className="flex items-center gap-4 text-slate-200 text-center sm:text-left">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-400/40 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-base font-medium">Лекции от лучших учёных России и мира</span>
          </div>
          <div className="hidden sm:block w-px h-10 bg-white/15 shrink-0" />
          <div className="flex items-center gap-4 text-slate-200 text-center sm:text-left">
            <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-cyan-400" />
            </div>
            <span className="text-base font-medium">Семинары со студентами МФТИ и ведущих вузов</span>
          </div>
        </div>
      </div>

      <a
        href="#about"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 w-8 h-12 border-2 border-white/30 rounded-full flex items-start justify-center p-2 animate-bounce"
      >
        <div className="w-1.5 h-3 bg-white rounded-full"></div>
      </a>
    </section>
  );
}


const FCK_SUPPORT = {
  shortName: 'ФЦК МФТИ',
  logo: '/fck_mfti_logo_small.png',
  description: 'Проект реализуется при поддержке Фонда целевого капитала МФТИ',
};

const PARTNER_LOGOS = [
  {
    name: 'МФТИ',
    logo: '/Лого_МФТИ.png',
    imgClass: 'h-full w-auto max-w-none object-contain scale-[1.7] sm:scale-[1.85]',
    cellClass: 'overflow-hidden',
  },
  {
    name: 'Российский квантовый центр',
    logo: '/rossiyskiy_kvantovyy_centr.jpg',
    imgClass: 'max-h-full max-w-full object-contain',
  },
  {
    name: 'Росатом',
    logo: '/logo-2.jpg',
    imgClass: 'max-h-full max-w-full object-contain',
  },
];

function Partners() {
  return (
    <section id="partners" className="py-20 sm:py-24 bg-gradient-to-b from-slate-100/90 via-slate-50 to-blue-50/30 border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100/90 border border-blue-200/80 rounded-full text-blue-700 text-sm font-medium mb-5">
            <Handshake className="w-4 h-4" />
            <span>Партнёрство</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
            Партнёры и поддерживающие организации
          </h2>
        </div>

        <div className="max-w-5xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 px-6 py-8 sm:px-12 sm:py-10">
          <div className="text-center">
            <p className="text-slate-500 text-sm leading-relaxed mb-3 max-w-2xl mx-auto">
              {FCK_SUPPORT.description}
            </p>
            <img
              src={FCK_SUPPORT.logo}
              alt={FCK_SUPPORT.shortName}
              className="h-28 sm:h-32 md:h-36 w-auto max-w-[400px] sm:max-w-[460px] object-contain mx-auto"
            />
          </div>

          <div className="my-7 sm:my-8 mx-auto max-w-2xl sm:max-w-3xl border-t border-slate-200" aria-hidden />

          <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-y-8 gap-x-10 sm:gap-x-12 lg:gap-x-14 max-w-3xl mx-auto">
            {PARTNER_LOGOS.map((p) => (
              <div
                key={p.name}
                className={`flex h-16 sm:h-20 items-center justify-center ${p.cellClass ?? ''}`}
              >
                <img src={p.logo} alt={p.name} className={p.imgClass} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Timeline() {
  const steps = [
    {
      num: '01',
      period: 'Июнь — Август 2026',
      title: 'Начало регистрации',
      items: ['Открытие приёма заявок', 'Регистрация на платформе', 'Знакомство с программой школы'],
      accent: 'from-blue-500 to-blue-600',
      glow: 'bg-blue-500/20',
      border: 'border-blue-500/30',
      tag: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
      dot: 'bg-blue-400',
    },
    {
      num: '02',
      period: 'Август — Сентябрь 2026',
      title: 'Отборочный этап',
      items: ['Отборочное тестирование и олимпиада', 'Оценка мотивации и уровня подготовки', 'Формирование групп участников'],
      accent: 'from-cyan-500 to-cyan-600',
      glow: 'bg-cyan-500/20',
      border: 'border-cyan-500/30',
      tag: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30',
      dot: 'bg-cyan-400',
    },
    {
      num: '03',
      period: 'Октябрь 2026 — Апрель 2027',
      title: 'Обучение и практика',
      items: ['Лекции ведущих учёных по квантовым технологиям', 'Семинары и регулярные встречи с наставниками', 'Решение задач и обсуждение современных исследований', 'Профориентационные встречи и разговоры о науке'],
      accent: 'from-blue-600 to-blue-700',
      glow: 'bg-blue-600/20',
      border: 'border-blue-600/30',
      tag: 'text-blue-200 bg-blue-600/10 border-blue-600/30',
      dot: 'bg-blue-300',
    },
    {
      num: '04',
      period: 'Май 2027',
      title: 'Итоговые проекты и выпуск',
      items: ['Работа над собственным проектом', 'Защита итоговых работ', 'Получение сертификатов и завершение программы'],
      accent: 'from-cyan-600 to-blue-600',
      glow: 'bg-cyan-600/20',
      border: 'border-cyan-600/30',
      tag: 'text-cyan-200 bg-cyan-600/10 border-cyan-600/30',
      dot: 'bg-cyan-300',
    },
  ];

  return (
    <section className="py-28 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-blue-500/8 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-cyan-500/8 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-0 w-[300px] h-[300px] bg-blue-700/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-16 relative z-10">
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 rounded-full text-blue-300 text-sm font-medium mb-5 backdrop-blur-sm">
            <Calendar className="w-4 h-4" />
            <span>Учебный год 2026–2027</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-5">Ключевые этапы</h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
            Путь от регистрации до выпуска — весь учебный год с первого взгляда
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {steps.map((step, i) => (
            <div
              key={i}
              className={`group relative p-8 rounded-3xl bg-white/5 border ${step.border} backdrop-blur-sm hover:bg-white/8 transition-all duration-400`}
            >
              <div className={`absolute -top-px left-8 right-8 h-px bg-gradient-to-r ${step.accent} opacity-60`} />

              <div className="flex items-start gap-5 mb-6">
                <div className={`flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br ${step.accent} flex items-center justify-center text-white text-xl font-bold shadow-lg`}>
                  {step.num}
                </div>
                <div>
                  <div className={`inline-block text-xs font-semibold px-3 py-1 rounded-full border ${step.tag} mb-2`}>
                    {step.period}
                  </div>
                  <h3 className="text-xl font-bold text-white leading-tight">{step.title}</h3>
                </div>
              </div>

              <ul className="space-y-2.5 pl-1">
                {step.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-3 text-slate-300 text-sm leading-relaxed">
                    <div className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${step.dot}`} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function About() {
  const topics = ['Квантовые вычисления', 'Квантовая связь', 'Квантовая оптика', 'ИИ и квантовые технологии', 'Профессии будущего'];
  const seminarItems = ['решать задачи', 'обсуждать лекции', 'разбирать исследования', 'готовиться к проектам'];

  return (
    <section id="about" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Left */}
          <div className="lg:pt-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full text-blue-600 text-sm font-medium mb-6">
              <Atom className="w-4 h-4" />
              <span>О нашей школе</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6">
              Готовим специалистов
              <br />
              <span className="text-gradient">будущего</span>
            </h2>
            <p className="text-slate-600 text-lg leading-relaxed">
              Квантовый кружок — это инновационная образовательная платформа для школьников
              9–11 классов, увлечённых квантовыми технологиями. Лекции учёных, семинары
              с наставниками и работа над проектами помогут тебе разобраться в сложных темах
              и сделать первые шаги в науке.
            </p>
          </div>

          {/* Right — Program card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-5">Программа школы</h3>

            <div className="space-y-4">
              {/* Лекции */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-lg font-bold text-blue-600">Лекции</span>
                      <span className="text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">10 лекций</span>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed mb-3">
                      Онлайн-лекции от ведущих учёных и экспертов о квантовых технологиях и современных исследованиях.
                    </p>
                    <p className="text-blue-600 text-xs font-semibold mb-2">Примерные темы:</p>
                    <div className="flex flex-wrap gap-2">
                      {topics.map(t => (
                        <span key={t} className="inline-flex items-center gap-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg px-2 py-1 bg-white">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0 inline-block" />
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Семинары */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl flex items-center justify-center">
                    <Award className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-lg font-bold text-cyan-600">Семинары</span>
                      <span className="text-xs font-medium text-cyan-600 bg-cyan-50 border border-cyan-200 rounded-full px-2 py-0.5">10 семинаров</span>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed mb-3">
                      Практические занятия в небольших группах с наставниками из ведущих вузов.
                    </p>
                    <p className="text-cyan-600 text-xs font-semibold mb-2">Что будем делать:</p>
                    <div className="flex flex-wrap gap-4">
                      {seminarItems.map(t => (
                        <span key={t} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0 inline-block" />
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Итоговый проект */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
                    <div>
                      <span className="text-lg font-bold text-blue-600 block mb-1">Итоговый проект</span>
                      <p className="text-slate-600 text-sm leading-relaxed">
                        Работа над собственным проектом в команде с наставником и защита результатов в конце курса.
                      </p>
                    </div>
                    <Award className="w-8 h-8 text-slate-300 flex-shrink-0 mt-0.5" />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center gap-3 rounded-xl bg-blue-600 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Atom className="w-4 h-4 text-white" />
                </div>
                <p className="text-white text-sm font-medium">Один учебный год: от первых знаний о квантовом мире до собственного проекта.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      icon: '🎓',
      title: 'Экспертное обучение',
      desc: 'Преподаватели — практикующие ученые из ведущих мировых центров квантовых исследований',
    },
    {
      icon: '💻',
      title: 'Современная платформа',
      desc: 'Интерактивные уроки, видеолекции, практические задания',
    },
    {
      icon: '🔬',
      title: 'Практика',
      desc: 'Возможность сделать собственный научный проект под руководством молодых ученых',
    },
    {
      icon: '📜',
      title: 'Сертификаты',
      desc: 'Документ при успешном прохождении курса',
    },
    {
      icon: '👥',
      title: 'Сообщество',
      desc: 'Доступ к закрытому сообществу квантовых специалистов и исследователей',
    },
    {
      icon: '🎯',
      title: 'Профориентационная поддержка',
      desc: 'Ответим на вопросы об обучении в ведущих технических вузах и научной работе',
    },
  ];

  return (
    <section className="py-24 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Почему выбирают Квантовый кружок?
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Мы создали уникальную экосистему для знакомства с квантовыми технологиями
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group p-8 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-cyan-500/50 hover:bg-white/10 transition-all duration-300"
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-slate-400">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const INSTRUCTOR_CAROUSEL_GAP = 20;
const INSTRUCTOR_MAX_VISIBLE = 4;
const INSTRUCTOR_MAX_CARD_W = 258;
const INSTRUCTOR_MIN_CARD_W = 188;
/** 2×w-10 buttons + gap-2 between them + gap-1.5 before carousel */
const INSTRUCTOR_CAROUSEL_NAV_RESERVED = 94;

function computeCarouselLayout(available: number) {
  let cardW = Math.floor((available - (INSTRUCTOR_MAX_VISIBLE - 1) * INSTRUCTOR_CAROUSEL_GAP) / INSTRUCTOR_MAX_VISIBLE);
  let visibleCount = INSTRUCTOR_MAX_VISIBLE;

  if (cardW > INSTRUCTOR_MAX_CARD_W) {
    cardW = INSTRUCTOR_MAX_CARD_W;
  } else if (cardW < INSTRUCTOR_MIN_CARD_W) {
    visibleCount = Math.max(
      1,
      Math.min(
        INSTRUCTOR_MAX_VISIBLE,
        Math.floor((available + INSTRUCTOR_CAROUSEL_GAP) / (INSTRUCTOR_MIN_CARD_W + INSTRUCTOR_CAROUSEL_GAP)),
      ),
    );
    cardW = Math.floor((available - (visibleCount - 1) * INSTRUCTOR_CAROUSEL_GAP) / visibleCount);
    cardW = Math.min(INSTRUCTOR_MAX_CARD_W, Math.max(INSTRUCTOR_MIN_CARD_W, cardW));
  }

  const viewportWidth = visibleCount * cardW + (visibleCount - 1) * INSTRUCTOR_CAROUSEL_GAP;
  return {
    viewportWidth,
    cardWidth: cardW,
    endSpacer: Math.max(0, viewportWidth - cardW),
  };
}

function InstructorCard({ instructor, cardWidth }: { instructor: Instructor; cardWidth: number }) {
  return (
    <div className="flex-shrink-0 snap-start pb-3" style={{ width: cardWidth }} data-instructor-card>
      <div className="group h-full transition-all duration-500 hover:-translate-y-1">
        <InstructorCardPreview
          name={instructor.name}
          title={instructor.title}
          bio={instructor.bio}
          imageUrl={instructor.image_url}
          width={cardWidth}
          interactive
          className="transition-all duration-500 group-hover:shadow-[0_16px_36px_-10px_rgba(15,23,42,0.18)] group-hover:border-slate-300"
          imageClassName="transform group-hover:scale-105 transition-transform duration-700"
        />
      </div>
    </div>
  );
}

function Instructors({ instructors, loading }: { instructors: Instructor[]; loading: boolean }) {
  const measureRef = React.useRef<HTMLDivElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{
    viewportWidth: number;
    cardWidth: number;
    endSpacer: number;
  } | null>(null);

  const measureViewport = useCallback(() => {
    const container = measureRef.current;
    if (!container) return;

    const available = container.clientWidth - INSTRUCTOR_CAROUSEL_NAV_RESERVED;
    if (available <= 0) return;

    setLayout(computeCarouselLayout(available));
  }, []);

  useEffect(() => {
    measureViewport();
    const container = measureRef.current;
    if (!container) return;

    const ro = new ResizeObserver(measureViewport);
    ro.observe(container);
    window.addEventListener('resize', measureViewport);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measureViewport);
    };
  }, [instructors, loading, measureViewport]);

  const scrollToCard = (card: HTMLElement, isLast: boolean) => {
    const scroll = scrollRef.current;
    if (!scroll || !layout) return;

    const left = isLast
      ? card.offsetLeft + card.offsetWidth - layout.viewportWidth
      : card.offsetLeft;

    scroll.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  };

  const scroll = (dir: 'left' | 'right') => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || !layout) return;

    const cards = Array.from(scrollEl.querySelectorAll<HTMLElement>('[data-instructor-card]'));
    if (!cards.length) return;

    let currentIndex = 0;
    for (let i = 0; i < cards.length; i++) {
      if (cards[i].offsetLeft + cards[i].offsetWidth / 2 >= scrollEl.scrollLeft) {
        currentIndex = i;
        break;
      }
      currentIndex = i;
    }

    const nextIndex =
      dir === 'right'
        ? Math.min(cards.length - 1, currentIndex + 1)
        : Math.max(0, currentIndex - 1);

    scrollToCard(cards[nextIndex], nextIndex === cards.length - 1);
  };

  return (
    <section id="instructors" className="py-24 bg-slate-100/90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2">
            Команда школы
          </h2>
          <p className="text-slate-600 text-lg max-w-2xl">
            Учитесь у ведущих специалистов в области квантовых вычислений и информатики
          </p>
        </div>

        <div ref={measureRef} className="w-full">
          <div className="flex items-start gap-1.5 w-max max-w-full" data-carousel-row>
            <div
              className="min-w-0 flex-shrink-0"
              style={{ width: layout?.viewportWidth }}
            >
              <div
                ref={scrollRef}
                className="flex gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory pt-2 pb-10 max-w-full"
                style={{
                  width: '100%',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
              >
              {(loading ? [1, 2, 3, 4] : instructors).map((item, index) => {
                const cardWidth = layout?.cardWidth ?? INSTRUCTOR_MAX_CARD_W;
                return loading ? (
                  <div key={index} className="flex-shrink-0 snap-start pb-3" style={{ width: cardWidth }} data-instructor-card>
                    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_8px_30px_-8px_rgba(15,23,42,0.12)] p-6 animate-pulse">
                      <div className={`w-full bg-slate-200 rounded-xl mb-4 ${cardWidth < 248 ? 'h-40' : 'h-44'}`}></div>
                      <div className="h-5 bg-slate-200 rounded w-3/4 mb-2"></div>
                      <div className="h-4 bg-slate-200 rounded w-1/2 mb-3"></div>
                      <div className="h-3 bg-slate-200 rounded w-full"></div>
                    </div>
                  </div>
                ) : (
                  <InstructorCard key={(item as Instructor).id} instructor={item as Instructor} cardWidth={cardWidth} />
                );
              })}
              {layout && (
                <div aria-hidden className="flex-shrink-0" style={{ width: layout.endSpacer }} />
              )}
            </div>
          </div>

          <div className="flex gap-2 flex-shrink-0 pt-2" data-carousel-nav>
            <button
              type="button"
              onClick={() => scroll('left')}
              className="w-10 h-10 flex items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <button
              type="button"
              onClick={() => scroll('right')}
              className="w-10 h-10 flex items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          </div>
        </div>
      </div>
    </section>
  );
}


function ApplicationForm() {
  const { user, signUp, signIn } = useAuth();
  const [suggestions, setSuggestions] = useState(() => getApplicationSuggestions());
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    city: '',
    school: '',
    grade: '',
    message: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [parentalConfirm, setParentalConfirm] = useState(false);
  const [consentError, setConsentError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const rememberField = (field: 'name' | 'email' | 'phone' | 'city' | 'school' | 'grade' | 'message', value: string) => {
    if (!value.trim()) return;
    rememberApplicationValues({ [field]: value });
    setSuggestions(getApplicationSuggestions());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConsentError('');

    if (!privacyConsent || !parentalConfirm) {
      setConsentError('Необходимо подтвердить согласие на обработку персональных данных');
      return;
    }

    setIsSubmitting(true);
    setError('');

    const consentAt = new Date().toISOString();

    try {
      if (!user) {
        const reg = await signUp(formData.email, formData.password, formData.name);
        if (reg.error) {
          setError(reg.error);
          return;
        }
        const login = await signIn(formData.email, formData.password);
        if (login.error) {
          setError('Аккаунт создан, но не удалось войти. Попробуйте войти через кнопку «Войти».');
          return;
        }
        const { data: { user: newUser } } = await supabase.auth.getUser();
        if (newUser) {
          await supabase.from('user_profiles').update({
            privacy_consent_at: consentAt,
            privacy_policy_version: PRIVACY_POLICY_VERSION,
            city: formData.city.trim() || null,
            school: formData.school.trim() || null,
            grade: formData.grade.trim() || null,
          }).eq('id', newUser.id);
        }
      }

      const { error: enrollError } = await supabase.from('enrollments').insert([
        {
          name: formData.name,
          email: formData.email,
          phone: formData.phone || null,
          city: formData.city || null,
          grade: formData.grade || null,
          message: formData.message || null,
          status: 'pending',
          privacy_consent: true,
          privacy_consent_at: consentAt,
          privacy_policy_version: PRIVACY_POLICY_VERSION,
          parental_confirm: true,
        },
      ]);

      if (enrollError) throw enrollError;

      rememberApplicationValues(formData);
      setSuggestions(getApplicationSuggestions());
      setIsSuccess(true);
      setFormData({ name: '', email: '', password: '', phone: '', city: '', school: '', grade: '', message: '' });
      setPrivacyConsent(false);
      setParentalConfirm(false);
    } catch {
      setError('Произошла ошибка при отправке. Попробуйте снова.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contact" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full text-blue-600 text-sm font-medium mb-4">
              <UserPlus className="w-4 h-4" />
              <span>Регистрация и заявка</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6">
              Регистрируйся и участвуй в отборе!
            </h2>
            <p className="text-slate-600 text-lg mb-4 leading-relaxed">
              Заполните одну форму: придумайте пароль для личного кабинета и укажите информацию о себе.
              После отправки вы сразу сможете войти и пройти отборочные этапы.
            </p>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              Мы обрабатываем персональные данные в соответствии с{' '}
              <a href="/privacy" target="_blank" className="text-blue-600 hover:text-blue-700 font-medium underline">
                Политикой конфиденциальности
              </a>
              . Пароль не передаётся третьим лицам.
            </p>

            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-700 rounded-xl flex items-center justify-center text-white flex-shrink-0">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm text-slate-500">Email</div>
                  <div className="text-slate-900 font-medium">quantumclub@rqc.ru</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-700 rounded-xl flex items-center justify-center text-white flex-shrink-0">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm text-slate-500">Адрес</div>
                  <div className="text-slate-900 font-medium">Москва, Сколково, Большой бульвар 30с1</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50">
            {user && !isSuccess ? (
              <div className="text-center py-8 space-y-4">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
                <h3 className="text-xl font-bold text-slate-900">Вы уже зарегистрированы</h3>
                <p className="text-slate-600 text-sm">Перейдите в личный кабинет, чтобы пройти отборочные этапы</p>
                <a
                  href="/dashboard"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
                >
                  <LogIn className="w-5 h-5" />
                  Личный кабинет
                </a>
              </div>
            ) : isSuccess ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Заявка отправлена!</h3>
                <p className="text-slate-600 mb-6">
                  Аккаунт создан. Используйте ваш email и пароль для входа в личный кабинет.
                </p>
                <a
                  href="/dashboard"
                  className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
                >
                  <LogIn className="w-5 h-5" />
                  Перейти в личный кабинет
                </a>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-1">Заявка на участие</h3>
                  <p className="text-slate-500 text-sm">Все поля со звёздочкой обязательны</p>
                </div>

                <datalist id="application-name-suggestions">
                  {suggestions.name.map((value) => (
                    <option key={value} value={value} />
                  ))}
                </datalist>
                <datalist id="application-email-suggestions">
                  {suggestions.email.map((value) => (
                    <option key={value} value={value} />
                  ))}
                </datalist>
                <datalist id="application-phone-suggestions">
                  {suggestions.phone.map((value) => (
                    <option key={value} value={value} />
                  ))}
                </datalist>
                <datalist id="application-city-suggestions">
                  {suggestions.city.map((value) => (
                    <option key={value} value={value} />
                  ))}
                </datalist>
                <datalist id="application-school-suggestions">
                  {suggestions.school.map((value) => (
                    <option key={value} value={value} />
                  ))}
                </datalist>
                <datalist id="application-grade-suggestions">
                  {suggestions.grade.map((value) => (
                    <option key={value} value={value} />
                  ))}
                </datalist>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">ФИО *</label>
                  <input
                    type="text"
                    required
                    list="application-name-suggestions"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    onBlur={(e) => rememberField('name', e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    placeholder="Иванов Иван Иванович"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Email *</label>
                    <input
                      type="email"
                      required
                      list="application-email-suggestions"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      onBlur={(e) => rememberField('email', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                      placeholder="email@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Телефон</label>
                    <input
                      type="tel"
                      list="application-phone-suggestions"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      onBlur={(e) => rememberField('phone', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                      placeholder="+7 (999) 123-45-67"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Пароль для личного кабинета *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                      placeholder="Придумайте пароль, минимум 6 символов"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Запомните пароль — он понадобится для входа на сайт</p>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Город</label>
                    <input
                      type="text"
                      list="application-city-suggestions"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      onBlur={(e) => rememberField('city', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                      placeholder="Москва"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Школа</label>
                    <input
                      type="text"
                      list="application-school-suggestions"
                      value={formData.school}
                      onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                      onBlur={(e) => rememberField('school', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                      placeholder="Лицей № 1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Класс</label>
                    <input
                      type="text"
                      list="application-grade-suggestions"
                      value={formData.grade}
                      onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                      onBlur={(e) => rememberField('grade', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                      placeholder="10"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Дополнительная информация</label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    onBlur={(e) => rememberField('message', e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none"
                    placeholder="Расскажите о своём опыте и целях..."
                  />
                </div>

                <PrivacyConsent
                  consent={privacyConsent}
                  onConsentChange={setPrivacyConsent}
                  parentalConfirm={parentalConfirm}
                  onParentalConfirmChange={setParentalConfirm}
                  error={consentError}
                />

                <p className="text-xs text-slate-400 leading-relaxed">
                  Нажимая кнопку ниже, вы подтверждаете достоверность указанных данных. Пароль не передаётся
                  третьим лицам и хранится только в защищённой системе авторизации.
                </p>

                {error && (
                  <div className="px-4 py-3 bg-rose-50 text-rose-600 rounded-xl text-sm">{error}</div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || !privacyConsent || !parentalConfirm}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold text-lg rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Зарегистрироваться и подать заявку
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-slate-900 text-white py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/logo_qc.svg" alt="Квантовый кружок" className="w-10 h-10 flex-shrink-0 brightness-0 invert" />
            <div className="min-w-0">
              <p className="text-lg font-semibold leading-tight">Квантовый кружок</p>
              <p className="text-slate-400 text-sm leading-relaxed mt-1 max-w-sm">
                Лидирующая онлайн-школа в области квантовых технологий. Готовим специалистов будущего.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-end gap-x-5 gap-y-2 text-sm text-slate-400">
            <a
              href="mailto:quantumclub@rqc.ru"
              className="inline-flex items-center gap-2 hover:text-blue-400 transition-colors break-all"
            >
              <Mail className="w-4 h-4 flex-shrink-0" />
              quantumclub@rqc.ru
            </a>
            <span className="inline-flex items-start sm:items-center gap-2 break-words">
              <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5 sm:mt-0" />
              Москва, Сколково, Большой бульвар 30с1
            </span>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-slate-400">
          <p>© 2024 Квантовый кружок</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <a href="/privacy" className="hover:text-blue-400 transition-colors">
              Политика конфиденциальности
            </a>
            <a href="/privacy#contacts" className="hover:text-blue-400 transition-colors">
              Обработка персональных данных
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default App;
