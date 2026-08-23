import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { Provider, User, Session } from '@supabase/supabase-js';
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

/** Сколько ждём сессию после возврата от Яндекса, прежде чем показать ошибку. */
const OAUTH_CALLBACK_TIMEOUT_MS = 15000;

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
  refreshProfile: () => Promise<void>;
  recordPrivacyConsent: () => Promise<{ error: string | null }>;
  oauthError: string | null;
  clearOAuthError: () => void;
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
  const profileRef = useRef<UserProfile | null>(null);

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

  const fetchProfile = useCallback(async (
    authUser: User,
    { background = false }: { background?: boolean } = {},
  ) => {
    if (!background) setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (error) {
        console.error('Profile fetch error:', error.message);
      }

      let nextProfile = (data as UserProfile | null) ?? null;

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
  }, [syncOAuthProfile, applyTeacherApplicationIfPending, clearStaleTeacherRejection]);

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
        setOauthError('Вход через Яндекс не завершился. Попробуйте ещё раз.');
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

  const signOut = async () => {
    clearLoginCorridor();
    await supabase.auth.signOut();
    setProfile(null);
    setProfileLoading(false);
  };

  const clearOAuthError = useCallback(() => setOauthError(null), []);

  return (
    <AuthContext.Provider value={{
      user, session, profile, loading, signInWithYandex, signInWithLogin, signUpWithLogin,
      signOut, refreshProfile, recordPrivacyConsent, oauthError, clearOAuthError,
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
