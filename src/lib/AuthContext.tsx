import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { UserProfile } from './types';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  /** Сессия или профиль ещё загружаются */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const profileRef = useRef<UserProfile | null>(null);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

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

      if (data) {
        setProfile(data);
        return;
      }

      const displayName =
        authUser.user_metadata?.full_name ||
        authUser.email?.split('@')[0] ||
        'Участник';

      const { data: created, error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          id: authUser.id,
          display_name: displayName,
          email: authUser.email ?? null,
          role: 'student',
        })
        .select('*')
        .maybeSingle();

      if (insertError) {
        console.error('Profile create error:', insertError.message);
        setProfile(null);
        return;
      }

      setProfile(created);
    } finally {
      if (!background) setProfileLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user, { background: true });
  }, [user, fetchProfile]);

  useEffect(() => {
    let mounted = true;

    const applySession = (nextSession: Session | null) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      return nextSession?.user ?? null;
    };

    const scheduleProfileFetch = (authUser: User) => {
      const hasProfile = profileRef.current?.id === authUser.id;
      window.setTimeout(() => {
        if (!mounted) return;
        void fetchProfile(authUser, { background: hasProfile });
      }, 0);
    };

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!mounted) return;

      const authUser = applySession(initialSession);
      if (authUser) {
        void fetchProfile(authUser).finally(() => {
          if (mounted) setInitializing(false);
        });
      } else {
        setInitializing(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      if (event === 'INITIAL_SESSION') return;

      const authUser = applySession(nextSession);

      if (authUser) {
        setProfile((prev) => (prev?.id === authUser.id ? prev : null));
        scheduleProfileFetch(authUser);
      } else {
        setProfile(null);
        setProfileLoading(false);
      }

      setInitializing(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const loading = initializing || (Boolean(user) && profileLoading && profile === null);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setProfileLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
