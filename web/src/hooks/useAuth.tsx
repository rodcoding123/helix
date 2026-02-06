import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { User, Session, AuthChangeEvent, AuthError, Provider } from '@supabase/supabase-js';
import {
  supabase,
  signIn as supabaseSignIn,
  signUp as supabaseSignUp,
  signOut as supabaseSignOut,
} from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  signInWithOAuth: (provider: Provider) => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthInternal();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

function useAuthInternal(): AuthContextType {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignIn = useCallback(
    async (email: string, password: string): Promise<{ error: AuthError | null }> => {
      setError(null);
      setLoading(true);

      const { data, error } = await supabaseSignIn(email, password);

      if (error) {
        setError(error.message);
        setLoading(false);
        return { error };
      }

      setUser(data.user);
      setSession(data.session);
      setLoading(false);
      return { error: null };
    },
    []
  );

  const handleSignUp = useCallback(
    async (email: string, password: string): Promise<{ error: AuthError | null }> => {
      setError(null);
      setLoading(true);

      const { data, error } = await supabaseSignUp(email, password);

      if (error) {
        setError(error.message);
        setLoading(false);
        return { error };
      }

      // If email confirmation is required, user will be null
      if (data.user) {
        setUser(data.user);
        setSession(data.session);
      }

      setLoading(false);
      return { error: null };
    },
    []
  );

  const handleSignOut = useCallback(async () => {
    setError(null);
    const { error } = await supabaseSignOut();

    if (error) {
      setError(error.message);
    } else {
      setUser(null);
      setSession(null);
    }
  }, []);

  const handleSignInWithOAuth = useCallback(
    async (provider: Provider): Promise<{ error: AuthError | null }> => {
      setError(null);

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setError(error.message);
        return { error };
      }

      return { error: null };
    },
    []
  );

  return {
    user,
    session,
    loading,
    error,
    signIn: handleSignIn,
    signUp: handleSignUp,
    signOut: handleSignOut,
    signInWithOAuth: handleSignInWithOAuth,
  };
}
