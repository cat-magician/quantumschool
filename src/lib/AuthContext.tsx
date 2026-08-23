import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { PostgrestError, Provider, User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { UserProfile } from './types';
import {
  markOAuthReturnPending,
  consumeOAuthReturnPending,
  consumeTeacherApplicationPending,
  markTeacherApplicationPending,
  YANDEX_OAUTH_PROVIDER,
} from './yandexAuthConfig';
import {
  getLoginCorridor,
  markStudentCorridorUnlocked,
  markTeacherLoginCorridor,
  markStudentLoginCorridor,
  clearLoginCorridor,
} from './loginCorridor';
import {
  consumeOAuthErrorFromUrl,
  hasOAuthCallbackInUrl,
  hasOAuthCodeInUrl,
} from './oauthCallbackUtils';
import { dashboardPathname, oauthDashboardRedirectPath, yandexDisplayName } from './yandexAuthUtils';
import {
  SUPPORT_EMAIL,
  loginToAuthEmail,
  translateLoginAuthError,
} from './loginAuthConfig';
import { PRIVACY_POLICY_VERSION } from './privacy';
import { markTeacherPromoted } from './teacherPromotionNotice';
import { markJustDemotedFromTeacher } from './studentCabinetSnapshot';

/**
 * Сколько ждём сессию после возврата от Яндекса. Обмен кода на сессию идёт
 * через Auth-сервис Supabase, и когда тот тормозит, пятнадцати секунд не
 * хватает: человек видел «вход не завершился» там, где вход бы дошёл.
 */
const OAUTH_CALLBACK_TIMEOUT_MS = 45000;

/** Профиль тянем с повторами: разовый сбой связи не должен ронять кабинет. */
const PROFILE_FETCH_RETRIES = 2;
const PROFILE_RETRY_BASE_DELAY_MS = 1200;

const delay = (ms: number) => new Promise((resolve) => { window.setTimeout(resolve, ms); });

/**
 * unauthorized — запрос дошёл до базы без принятого токена (PostgREST выполнил
 * его как anon, отсюда 42501 на RPC и пустая выборка профиля). Повторы тут не
 * помогут, нужна новая сессия.
 * unavailable — связи нет или сервис не отвечает; это лечится повтором.
 */
export type ProfileLoadError = {
  kind: 'unauthorized' | 'unavailable';
  detail: string;
};

function describeProfileLoadError(error: PostgrestError): ProfileLoadError {
  const unauthorized = error.code === '42501'
    || error.code === 'PGRST301'
    || error.code === 'PGRST302'
    || /jwt|unauthorized|permission denied/i.test(error.message);

  return { kind: unauthorized ? 'unauthorized' : 'unavailable', detail: error.message };
}

/** Столько ждём каждую попытку выхода, прежде чем перейти к запасной. */
const SIGN_OUT_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('timeout')), ms);
    Promise.resolve(promise).then(
      (value) => { window.clearTimeout(timer); resolve(value); },
      (error) => { window.clearTimeout(timer); reject(error); },
    );
  });
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  /** Сессия или профиль ещё загружаются */
  loading: boolean;
  signInWithYandex: (options?: {
    teacherApplication?: boolean;
  }) => Promise<{ error: string | null }>;
  signInWithLogin: (params: {
    login: string;
    password: string;
    teacherApplication?: boolean;
  }) => Promise<{ error: string | null }>;
  signUpWithLogin: (params: {
    login: string;
    password: string;
    name: string;
    recoveryEmail?: string;
    teacherApplication?: boolean;
  }) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  /** Выход в процессе: кнопки блокируются, чтобы не жать повторно. */
  signingOut: boolean;
  refreshProfile: () => Promise<void>;
  recordPrivacyConsent: () => Promise<{ error: string | null }>;
  oauthError: string | null;
  clearOAuthError: () => void;
  /** Почему профиль не загрузился; null — загрузился или его просто нет. */
  profileError: ProfileLoadError | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Профиль создаёт триггер handle_new_user, но email и имя из Яндекса могут
// разойтись с профилем — тогда их дотягивает sync_oauth_user_profile.
function profileNeedsOAuthSync(user: User, profile: UserProfile | null): boolean {
  if (!profile) return true;
  const authEmail = user.email?.trim().toLowerCase() ?? '';
  if (authEmail && profile.email?.trim().toLowerCase() !== authEmail) return true;
  if (profile.display_name?.trim()) return false;
  return Boolean(yandexDisplayName(user));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<ProfileLoadError | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const profileRef = useRef<UserProfile | null>(null);
  const signingOutRef = useRef(false);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const syncOAuthProfile = useCallback(async (
    authUser: User,
    existingProfile: UserProfile | null,
  ): Promise<UserProfile | null> => {
    if (!profileNeedsOAuthSync(authUser, existingProfile)) return existingProfile;

    const { data, error } = await supabase.rpc('sync_oauth_user_profile', {
      p_privacy_consent: false,
      p_privacy_version: PRIVACY_POLICY_VERSION,
    });

    if (error) {
      console.error('OAuth profile sync error:', error.message);
      return existingProfile;
    }

    return (data as UserProfile | null) ?? existingProfile;
  }, []);

  const applyTeacherApplicationIfPending = useCallback(async (
    authUser: User,
    existingProfile: UserProfile | null,
  ): Promise<UserProfile | null> => {
    if (!consumeTeacherApplicationPending()) return existingProfile;
    if (!existingProfile || existingProfile.teacher_application) return existingProfile;

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        teacher_application: true,
        teacher_application_rejected: false,
        updated_at: now,
      })
      .eq('id', authUser.id)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('Teacher application error:', error.message);
      return existingProfile;
    }

    return (data as UserProfile | null) ?? existingProfile;
  }, []);

  /** Отказ в преподаватели не должен блокировать ученический кабинет на том же аккаунте. */
  const clearStaleTeacherRejection = useCallback(async (
    existingProfile: UserProfile | null,
  ): Promise<UserProfile | null> => {
    if (
      !existingProfile
      || !existingProfile.teacher_application_rejected
      || existingProfile.teacher_application
    ) {
      return existingProfile;
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        teacher_application_rejected: false,
        updated_at: now,
      })
      .eq('id', existingProfile.id)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('Clear teacher rejection error:', error.message);
      return existingProfile;
    }

    return (data as UserProfile | null) ?? existingProfile;
  }, []);

  const loadProfileRow = useCallback(async (
    userId: string,
  ): Promise<{ row: UserProfile | null; error: PostgrestError | null }> => {
    let lastError: PostgrestError | null = null;

    for (let attempt = 0; attempt <= PROFILE_FETCH_RETRIES; attempt += 1) {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!error) return { row: (data as UserProfile | null) ?? null, error: null };

      lastError = error;
      // Токен не приняли — от повторов права не появятся.
      if (describeProfileLoadError(error).kind === 'unauthorized') break;
      if (attempt < PROFILE_FETCH_RETRIES) await delay(PROFILE_RETRY_BASE_DELAY_MS * (attempt + 1));
    }

    return { row: null, error: lastError };
  }, []);

  const fetchProfile = useCallback(async (
    authUser: User,
    { background = false }: { background?: boolean } = {},
  ) => {
    if (!background) setProfileLoading(true);
    try {
      const { row, error } = await loadProfileRow(authUser.id);

      if (error) {
        const described = describeProfileLoadError(error);
        console.error('Profile fetch error:', error.code, error.message);
        setProfileError(described);
        // Уже показанный кабинет не гасим: фоновое обновление могло просто не дойти.
        if (profileRef.current?.id !== authUser.id) setProfile(null);
        return;
      }

      setProfileError(null);
      let nextProfile = row;

      nextProfile = await syncOAuthProfile(authUser, nextProfile);
      nextProfile = await applyTeacherApplicationIfPending(authUser, nextProfile);
      nextProfile = await clearStaleTeacherRejection(nextProfile);

      const prevRole = profileRef.current?.role;
      const nextRole = nextProfile?.role ?? 'student';
      if (
        nextProfile
        && prevRole === 'student'
        && nextRole === 'admin'
      ) {
        markTeacherPromoted(authUser.id);
      }

      if (
        nextProfile
        && prevRole === 'admin'
        && nextRole === 'student'
      ) {
        markJustDemotedFromTeacher(authUser.id);
        markStudentCorridorUnlocked(authUser.id);
      }

      if (
        nextProfile?.teacher_application
        && getLoginCorridor() === 'student'
      ) {
        markStudentCorridorUnlocked(authUser.id);
      }

      setProfile(nextProfile);
    } finally {
      if (!background) setProfileLoading(false);
    }
  }, [loadProfileRow, syncOAuthProfile, applyTeacherApplicationIfPending, clearStaleTeacherRejection]);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user, { background: true });
  }, [user, fetchProfile]);

  useEffect(() => {
    let mounted = true;
    let oauthTimer: number | undefined;

    const applySession = (nextSession: Session | null) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      return nextSession?.user ?? null;
    };

    const finishInit = () => {
      window.clearTimeout(oauthTimer);
      setInitializing(false);
    };

    // Загрузку профиля нельзя запускать внутри onAuthStateChange: коллбэк
    // держит внутренний лок supabase-js.
    const scheduleProfileFetch = (authUser: User) => {
      const hasProfile = profileRef.current?.id === authUser.id;
      if (!hasProfile) setProfileLoading(true);
      window.setTimeout(() => {
        if (!mounted) return;
        void fetchProfile(authUser, { background: hasProfile });
      }, 0);
    };

    // Supabase уважает redirectTo только если адрес есть в Redirect URLs,
    // иначе возвращает на Site URL — дотягиваем до кабинета вручную.
    const redirectAfterOAuthIfNeeded = (): boolean => {
      if (!consumeOAuthReturnPending()) return false;
      if (window.location.pathname === dashboardPathname()) return false;
      window.location.replace(oauthDashboardRedirectPath());
      return true;
    };

    // Supabase при ошибке или если redirectTo не в allowlist шлёт на Site URL (/),
    // а экран ошибки и обмен code→session настроены на /dashboard.
    if (hasOAuthCallbackInUrl() && window.location.pathname !== dashboardPathname()) {
      window.location.replace(
        `${dashboardPathname()}${window.location.search}${window.location.hash}`,
      );
      return;
    }

    const urlOAuthError = consumeOAuthErrorFromUrl();
    if (urlOAuthError) {
      consumeOAuthReturnPending();
      setOauthError(urlOAuthError);
    }

    // Код на сессию меняет сам supabase-js (detectSessionInUrl), затем шлёт SIGNED_IN.
    const awaitingOAuth = !urlOAuthError && hasOAuthCodeInUrl();

    if (awaitingOAuth) {
      oauthTimer = window.setTimeout(() => {
        if (!mounted) return;
        consumeOAuthReturnPending();
        setOauthError(
          'Вход через Яндекс не завершился: сервис авторизации отвечает слишком долго. '
          + 'Попробуйте ещё раз через пару минут.',
        );
        setInitializing(false);
      }, OAUTH_CALLBACK_TIMEOUT_MS);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;

      const authUser = applySession(nextSession);

      if (authUser) {
        setProfile((prev) => (prev?.id === authUser.id ? prev : null));
        scheduleProfileFetch(authUser);
        if (redirectAfterOAuthIfNeeded()) return;
        finishInit();
        return;
      }

      setProfile(null);
      setProfileLoading(false);

      // При возврате от Яндекса в INITIAL_SESSION сессии ещё нет — ждём SIGNED_IN.
      if (awaitingOAuth && event === 'INITIAL_SESSION') return;
      finishInit();
    });

    return () => {
      mounted = false;
      window.clearTimeout(oauthTimer);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const loading = initializing || (Boolean(user) && profileLoading && profile === null);

  /**
   * Куда вести после входа и подавать ли заявку преподавателя. Ставится до
   * запроса: профиль подтягивается из onAuthStateChange и успевает раньше,
   * чем вернётся await.
   */
  const markLoginIntent = (teacherApplication?: boolean) => {
    if (teacherApplication) {
      markTeacherApplicationPending();
      markTeacherLoginCorridor();
    } else {
      markStudentLoginCorridor();
    }
  };

  /** Вход не состоялся — снять заявку, иначе она уедет со следующим входом. */
  const abandonLoginIntent = () => {
    consumeTeacherApplicationPending();
  };

  const signInWithLogin = async ({ login, password, teacherApplication }: {
    login: string;
    password: string;
    teacherApplication?: boolean;
  }) => {
    markLoginIntent(teacherApplication);

    const { error } = await supabase.auth.signInWithPassword({
      email: loginToAuthEmail(login),
      password,
    });

    if (error) {
      abandonLoginIntent();
      return { error: translateLoginAuthError(error.message) };
    }

    return { error: null };
  };

  const signUpWithLogin = async ({
    login, password, name, recoveryEmail, teacherApplication,
  }: {
    login: string;
    password: string;
    name: string;
    recoveryEmail?: string;
    teacherApplication?: boolean;
  }) => {
    markLoginIntent(teacherApplication);

    const { data, error } = await supabase.auth.signUp({
      email: loginToAuthEmail(login),
      password,
      options: {
        data: {
          full_name: name.trim(),
          recovery_email: recoveryEmail?.trim().toLowerCase() || null,
        },
      },
    });

    if (error) {
      abandonLoginIntent();
      return { error: translateLoginAuthError(error.message) };
    }

    // Сессии нет — в проекте включён Confirm email. Письмо уйдёт на техничес-
    // кий адрес и не дойдёт ни до кого, аккаунт останется неподтверждённым.
    if (!data.session) {
      abandonLoginIntent();
      console.error(
        'Supabase зарегистрировал пользователя без сессии. '
        + 'Выключите Authentication → Sign In / Providers → Email → Confirm email: '
        + 'технические адреса логинов не принимают почту.',
      );
      return {
        error: `Регистрация по логину сейчас недоступна. Войдите через Яндекс ID или напишите на ${SUPPORT_EMAIL}`,
      };
    }

    return { error: null };
  };

  const signInWithYandex = async (options?: {
    teacherApplication?: boolean;
  }) => {
    markLoginIntent(options?.teacherApplication);
    markOAuthReturnPending();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: YANDEX_OAUTH_PROVIDER as Provider,
      options: {
        redirectTo: oauthDashboardRedirectPath(),
        // Экран выбора аккаунта Яндекса при каждом входе (не при каждом визите в кабинет).
        queryParams: { force_confirm: 'yes' },
      },
    });

    return { error: error?.message ?? null };
  };

  const recordPrivacyConsent = useCallback(async () => {
    if (!user) return { error: 'Не выполнен вход' };

    const { data, error } = await supabase.rpc('sync_oauth_user_profile', {
      p_privacy_consent: true,
      p_privacy_version: PRIVACY_POLICY_VERSION,
    });

    if (error) {
      console.error('Privacy consent error:', error.message);
      return { error: error.message };
    }

    const nextProfile = (data as UserProfile | null) ?? profile;
    setProfile(nextProfile);
    return { error: null };
  }, [user, profile]);

  /**
   * Выход не должен зависеть от сети и от того, жива ли сессия на сервере.
   * Глобальный signOut отзывает refresh-токены на всех устройствах, но он
   * ходит в /logout: если запрос упал, завис или сессия уже протухла,
   * supabase-js оставляет локальную сессию — и кнопка «Выйти» молча ничего
   * не делает. Поэтому: тайм-аут, затем локальное гашение (оно только стирает
   * хранилище, без сети), а в самом конце всё равно чистим состояние.
   */
  const signOut = async () => {
    // Ref, а не состояние: два клика подряд успевают пройти до перерисовки.
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    setSigningOut(true);

    clearLoginCorridor();

    try {
      const { error } = await withTimeout(
        supabase.auth.signOut(),
        SIGN_OUT_TIMEOUT_MS,
      );
      if (error) throw error;
    } catch (globalError) {
      console.error('Глобальный выход не удался, гасим сессию локально:', globalError);
      try {
        await withTimeout(
          supabase.auth.signOut({ scope: 'local' }),
          SIGN_OUT_TIMEOUT_MS,
        );
      } catch (localError) {
        console.error('Локальный выход тоже не удался:', localError);
      }
    }

    // Не ждём SIGNED_OUT: если событие не придёт, человек останется в кабинете.
    setSession(null);
    setUser(null);
    setProfile(null);
    setProfileError(null);
    setProfileLoading(false);
    signingOutRef.current = false;
    setSigningOut(false);
  };

  const clearOAuthError = useCallback(() => setOauthError(null), []);

  return (
    <AuthContext.Provider value={{
      user, session, profile, loading, signInWithYandex, signInWithLogin, signUpWithLogin,
      signOut, signingOut, refreshProfile, recordPrivacyConsent, oauthError, clearOAuthError,
      profileError,
    }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
