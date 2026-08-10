import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useAuth } from './lib/AuthContext';
import { Instructor } from './lib/types';
import { DEFAULT_LANDING_CONFIG, fetchLandingConfig } from './lib/landingConfig';
import AuthModal from './components/AuthModal';
import StudentCabinetLink from './components/StudentCabinetLink';
import YandexSignInButton from './components/YandexSignInButton';
import QuantumBrandTitle from './components/QuantumBrandTitle';
import HeroQuantumDecor from './components/HeroQuantumDecor';
import HeroBadgePill from './components/HeroBadgePill';
import InstructorCardPreview from './components/InstructorCardPreview';
import { isInstructorPublishable } from './lib/siteContentLimits';
import { isYandexOAuthEnabled } from './lib/yandexAuthConfig';
import { appHref, publicAsset } from './lib/appPaths';
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
  CheckCircle,
  LogIn,
  Calendar,
  UserPlus,
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
            <img src={publicAsset('/logo_qc.svg')} alt="Квантовый кружок" className={`w-10 h-10 transform group-hover:rotate-12 transition-all duration-300 ${scrolled ? '' : 'brightness-0 invert'}`} />
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
            <a href={appHref('/join/teacher')} className={actionGhost}>
              Для преподавателей
            </a>
            {user ? (
              <>
                <StudentCabinetLink href={appHref('/dashboard')} className={actionOutline}>
                  <LogIn className="w-4 h-4 shrink-0" />
                  Кабинет
                </StudentCabinetLink>
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
              href={appHref('/join/teacher')}
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
                  <StudentCabinetLink
                    href={appHref('/dashboard')}
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center justify-center gap-2 w-full h-11 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm"
                  >
                    <LogIn className="w-4 h-4 shrink-0" />
                    Личный кабинет
                  </StudentCabinetLink>
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
      className="relative min-h-screen flex items-center justify-center overflow-x-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950"
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

        <div className="absolute bottom-0 right-0 w-[140px] sm:w-[280px] md:w-[340px] lg:w-[400px] h-auto opacity-90 pointer-events-none max-sm:opacity-50 max-sm:translate-x-2 animate-bounce" style={{ animationDuration: '4s' }} aria-hidden>
          <img src={publicAsset('/image.svg')} alt="" className="w-full h-auto" loading="lazy" decoding="async" />
        </div>
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24 md:py-28 pb-24 sm:pb-28 text-center">
        <div className="flex flex-col items-center gap-7 sm:gap-9 md:gap-10">
          <HeroBadgePill text={heroBadgeText} className="animate-fade-in max-w-full" />

          <QuantumBrandTitle />

          <div className="flex flex-col items-center gap-4 sm:gap-5 w-full max-w-2xl">
            <div className="space-y-1 sm:space-y-1.5 animate-slide-up w-full">
              <p className="text-lg sm:text-xl md:text-2xl font-semibold text-white/95 leading-snug tracking-tight text-balance">
                Онлайн-школа МФТИ и РКЦ
              </p>
              <p className="text-base sm:text-lg md:text-xl font-medium leading-snug text-balance">
                <span className="hero-subtitle-gradient">по квантовым технологиям</span>
              </p>
            </div>

            <p className="text-sm sm:text-base md:text-lg text-slate-400 max-w-xl leading-relaxed text-balance animate-fade-in">
              Первая в России онлайн-школа по квантовым технологиям и смежным областям для школьников 9–11 классов
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 w-full max-w-md sm:max-w-none">
            <a
              href="#contact"
              className="group justify-center px-7 sm:px-8 py-3.5 sm:py-4 bg-gradient-to-r from-blue-600 to-purple-700 text-white font-semibold text-base sm:text-lg rounded-2xl hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              Поступить на курс
              <ChevronRight className="w-5 h-5" />
            </a>
            {user ? (
              <StudentCabinetLink
                href={appHref('/dashboard')}
                className="justify-center px-7 sm:px-8 py-3.5 sm:py-4 bg-white/10 backdrop-blur-sm text-white font-semibold text-base sm:text-lg rounded-2xl border border-white/20 hover:bg-white/20 transition-all duration-300 flex items-center gap-2"
              >
                <LogIn className="w-5 h-5" /> Личный кабинет
              </StudentCabinetLink>
            ) : (
              <button
                type="button"
                onClick={onLoginClick}
                className="justify-center px-7 sm:px-8 py-3.5 sm:py-4 bg-white/10 backdrop-blur-sm text-white font-semibold text-base sm:text-lg rounded-2xl border border-white/20 hover:bg-white/20 transition-all duration-300 flex items-center gap-2"
              >
                <LogIn className="w-5 h-5" /> Войти
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-5 sm:gap-8 max-w-2xl w-full pt-6 sm:pt-8 border-t border-white/[0.08]">
            <div className="flex items-center gap-3 sm:gap-4 text-slate-300 text-center sm:text-left max-w-xs sm:max-w-none">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-400/40 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-sm sm:text-base font-medium leading-snug">Лекции от лучших учёных России и мира</span>
            </div>
            <div className="hidden sm:block w-px h-10 bg-white/15 shrink-0" />
            <div className="flex items-center gap-3 sm:gap-4 text-slate-300 text-center sm:text-left max-w-xs sm:max-w-none">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-cyan-400" />
              </div>
              <span className="text-sm sm:text-base font-medium leading-snug">Семинары со студентами МФТИ и ведущих вузов РФ</span>
            </div>
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
  logo: publicAsset('/fck_mfti_logo_small.png'),
  description: 'Проект реализуется при поддержке Фонда целевого капитала МФТИ',
};

const PARTNER_LOGOS = [
  {
    name: 'МФТИ',
    logo: publicAsset('/mfti-logo.png'),
    imgClass: 'h-full w-auto max-w-none object-contain scale-[1.7] sm:scale-[1.85]',
    cellClass: 'overflow-hidden',
  },
  {
    name: 'Российский квантовый центр',
    logo: publicAsset('/rossiyskiy_kvantovyy_centr.jpg'),
    imgClass: 'max-h-full max-w-full object-contain',
  },
  {
    name: 'Росатом',
    logo: publicAsset('/logo-2.jpg'),
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
      items: [
        'Получение сертификатов и завершение программы',
        'Работа над собственным проектом',
        'Защита итоговых работ',
      ],
      starredIndex: 1,
      footnote: 'Возможность выполнить свой первый научно-исследовательский проект',
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
                    <span>
                      {item}
                      {'starredIndex' in step && step.starredIndex === j ? (
                        <span className="text-blue-300" aria-hidden>*</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
              {'footnote' in step && step.footnote ? (
                <p className="mt-3 pl-1 text-slate-400 text-xs leading-relaxed">
                  <span className="text-blue-300" aria-hidden>* </span>
                  {step.footnote}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function About() {
  const topics = ['Квантовые вычисления', 'Квантовая связь', 'Квантовая оптика', 'ИИ и квантовые технологии', 'Профессии будущего'];
  const seminarItems = ['решать задачи', 'закреплять материал лекций', 'разбирать исследования', 'готовиться к проектам'];
  const finalProjectPerks = [
    'собственный итоговый проект с наставником',
    'защита работ перед жюри',
    'сертификат школы',
    'мерч и памятные призы от кружка',
  ];

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
                    <p className="text-blue-600 text-xs font-semibold mb-2">Темы:</p>
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
                      Практические занятия и личные консультации с наставником в небольших группах.
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
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <span className="text-lg font-bold text-blue-600">Итоговый проект</span>
                      <span className="text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-2 py-0.5">
                        После основного курса
                      </span>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed mb-3">
                      Финал для тех, кто освоил программу: доведёте идею до результата, защитите работу
                      и получите признание школы.
                    </p>
                    <p className="text-blue-600 text-xs font-semibold mb-2">Что ждёт финалистов:</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {finalProjectPerks.map((t) => (
                        <span key={t} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0 inline-block" />
                          {t}
                        </span>
                      ))}
                    </div>
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
    visibleCount,
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
          live
          className="transition-all duration-500 group-hover:shadow-[0_16px_36px_-10px_rgba(15,23,42,0.18)] group-hover:border-slate-300"
          imageClassName="transform group-hover:scale-105 transition-transform duration-700"
        />
      </div>
    </div>
  );
}

function Instructors({ instructors, loading }: { instructors: Instructor[]; loading: boolean }) {
  const visibleInstructors = instructors.filter((instructor) => isInstructorPublishable(instructor));
  const measureRef = React.useRef<HTMLDivElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{
    viewportWidth: number;
    cardWidth: number;
    visibleCount: number;
    constrainViewport: boolean;
  } | null>(null);

  const measureViewport = useCallback(() => {
    const container = measureRef.current;
    if (!container) return;

    const isDesktop = window.matchMedia('(min-width: 640px)').matches;
    const navReserved = isDesktop ? INSTRUCTOR_CAROUSEL_NAV_RESERVED : 0;
    const available = container.clientWidth - navReserved;
    if (available <= 0) return;

    setLayout({
      ...computeCarouselLayout(available),
      constrainViewport: isDesktop,
    });
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
  }, [visibleInstructors, loading, measureViewport]);

  const getMaxScroll = (scrollEl: HTMLElement) =>
    Math.max(0, scrollEl.scrollWidth - scrollEl.clientWidth);

  const getScrollStep = (cards: HTMLElement[]) => {
    if (cards.length < 2) return cards[0]?.offsetWidth ?? INSTRUCTOR_CAROUSEL_GAP;
    return cards[1].offsetLeft - cards[0].offsetLeft;
  };

  const scroll = (dir: 'left' | 'right') => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const cards = Array.from(scrollEl.querySelectorAll<HTMLElement>('[data-instructor-card]'));
    if (!cards.length) return;

    const maxScroll = getMaxScroll(scrollEl);
    if (maxScroll <= 0) return;

    const step = getScrollStep(cards);
    if (step <= 0) return;

    const current = scrollEl.scrollLeft;
    const atStart = current <= 1;
    const atEnd = current >= maxScroll - 1;

    let target: number;
    if (dir === 'right') {
      if (atEnd) return;
      target = Math.min(maxScroll, current + step);
    } else {
      if (atStart) return;
      target = Math.max(0, current - step);
    }

    scrollEl.scrollTo({ left: target, behavior: 'smooth' });
  };

  const canScrollCarousel =
    !loading && visibleInstructors.length > (layout?.visibleCount ?? INSTRUCTOR_MAX_VISIBLE);

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
          <div className="flex items-start gap-1.5">
            <div
              ref={scrollRef}
              className="instructor-carousel-scroll min-w-0 flex-1 scroll-smooth snap-x snap-proximity sm:snap-mandatory pt-2 pb-4 -mx-4 px-4 sm:mx-0 sm:px-0"
              style={layout?.constrainViewport ? { maxWidth: layout.viewportWidth } : undefined}
            >
              <div className="instructor-carousel-track gap-5 pr-4 sm:pr-2">
                {(loading ? [1, 2, 3, 4] : visibleInstructors).map((item, index) => {
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
              </div>
            </div>

            <div className={`hidden sm:flex gap-2 flex-shrink-0 pt-2 ${canScrollCarousel ? '' : 'invisible pointer-events-none'}`}>
              <button
                type="button"
                onClick={() => scroll('left')}
                disabled={!canScrollCarousel}
                className="w-10 h-10 flex items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 disabled:opacity-40"
                aria-label="Предыдущий преподаватель"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
              <button
                type="button"
                onClick={() => scroll('right')}
                disabled={!canScrollCarousel}
                className="w-10 h-10 flex items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 disabled:opacity-40"
                aria-label="Следующий преподаватель"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className={`flex sm:hidden gap-2 justify-end pt-2 ${canScrollCarousel ? '' : 'hidden'}`}>
            <button
              type="button"
              onClick={() => scroll('left')}
              disabled={!canScrollCarousel}
              className="w-10 h-10 flex items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 disabled:opacity-40"
              aria-label="Предыдущий преподаватель"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <button
              type="button"
              onClick={() => scroll('right')}
              disabled={!canScrollCarousel}
              className="w-10 h-10 flex items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 disabled:opacity-40"
              aria-label="Следующий преподаватель"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}


function ApplicationForm() {
  const { user } = useAuth();

  return (
    <section id="contact" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full text-blue-600 text-sm font-medium mb-4">
              <UserPlus className="w-4 h-4" />
              <span>Регистрация</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6">
              Регистрируйся и участвуй в отборе!
            </h2>
            <p className="text-slate-600 text-lg mb-4 leading-relaxed">
              Успешно прошедшие отбор продолжат обучение на годовом курсе кружка.
            </p>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              Мы обрабатываем персональные данные в соответствии с{' '}
              <a href={appHref('/privacy')} target="_blank" className="text-blue-600 hover:text-blue-700 font-medium underline">
                Политикой конфиденциальности
              </a>
              .
            </p>

            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-700 rounded-xl flex items-center justify-center text-white flex-shrink-0">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm text-slate-500">Email</div>
                  <div className="text-slate-900 font-medium">quantumschool@rqc.ru</div>
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

          <div className="lg:sticky lg:top-28 relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/50">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#FC3F1D]/[0.07] via-amber-50/40 to-transparent"
              aria-hidden
            />
            <div className="relative p-8 sm:p-10">
              {user ? (
                <div className="text-center py-4 space-y-5">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">Вы уже зарегистрированы</h3>
                    <p className="text-slate-600 leading-relaxed">
                      Отборочные этапы проходят в личном кабинете
                    </p>
                  </div>
                  <StudentCabinetLink
                    href={appHref('/dashboard')}
                    className="inline-flex items-center justify-center gap-2 w-full h-14 px-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
                  >
                    <LogIn className="w-5 h-5" />
                    Личный кабинет
                  </StudentCabinetLink>
                </div>
              ) : (
                <div className="space-y-8 py-2">
                  <div className="text-center space-y-2">
                    <h3 className="text-2xl sm:text-3xl font-bold text-slate-900">Регистрация через Яндекс ID</h3>
                    <p className="text-slate-500 leading-relaxed max-w-sm mx-auto text-base">
                      Создайте личный кабинет и начните обучение в нашем кружке.
                    </p>
                  </div>

                  {isYandexOAuthEnabled() ? (
                    <YandexSignInButton
                      size="xl"
                      label="Создать аккаунт с Яндекс ID"
                    />
                  ) : (
                    <p className="text-sm text-amber-700 text-center px-4 py-3 bg-amber-50 rounded-xl">
                      Регистрация через Яндекс ID временно недоступна. Напишите на quantumschool@rqc.ru
                    </p>
                  )}
                </div>
              )}
            </div>
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
            <img src={publicAsset('/logo_qc.svg')} alt="Квантовый кружок" className="w-10 h-10 flex-shrink-0 brightness-0 invert" />
            <div className="min-w-0">
              <p className="text-lg font-semibold leading-tight">Квантовый кружок</p>
              <p className="text-slate-400 text-sm leading-relaxed mt-1 max-w-sm">
                Лидирующая онлайн-школа в области квантовых технологий. Готовим специалистов будущего.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-end gap-x-5 gap-y-2 text-sm text-slate-400">
            <a
              href="mailto:quantumschool@rqc.ru"
              className="inline-flex items-center gap-2 hover:text-blue-400 transition-colors break-all"
            >
              <Mail className="w-4 h-4 flex-shrink-0" />
              quantumschool@rqc.ru
            </a>
            <span className="inline-flex items-start sm:items-center gap-2 break-words">
              <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5 sm:mt-0" />
              Москва, Сколково, Большой бульвар 30с1
            </span>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-slate-400">
          <p>© 2026 Квантовый кружок</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <a href={appHref('/privacy')} className="hover:text-blue-400 transition-colors">
              Политика конфиденциальности
            </a>
            <a href={appHref('/privacy#contacts')} className="hover:text-blue-400 transition-colors">
              Обработка персональных данных
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default App;
