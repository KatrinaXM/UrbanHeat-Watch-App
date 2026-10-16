import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isGuest: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    fullName?: string
  ) => Promise<{ data: any; error: Error | null }>;
  resendConfirmation: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  signInAsGuest: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (mounted) {
          if (!error && data.session) {
            setSession(data.session);
            setUser(data.session.user);
            setIsGuest(false);
          }
        }
      } catch (err) {
        console.warn('Error reading initial Supabase session:', err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession) {
        setIsGuest(false);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) return { error };
      setSession(data.session);
      setUser(data.user);
      setIsGuest(false);
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  }

  async function signUp(email: string, password: string, fullName?: string) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: fullName?.trim() ? { full_name: fullName.trim() } : undefined,
        },
      });
      if (error) return { data: null, error };
      if (data.session) {
        setSession(data.session);
        setUser(data.user);
        setIsGuest(false);
      }
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }

  async function resendConfirmation(email: string) {
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
      return { error };
    } catch (err: any) {
      return { error: err };
    }
  }

  async function signOut() {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Error during Supabase signOut:', err);
    } finally {
      setSession(null);
      setUser(null);
      setIsGuest(false);
    }
  }

  function signInAsGuest() {
    setIsGuest(true);
    setUser(null);
    setSession(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isGuest,
        signIn,
        signUp,
        resendConfirmation,
        signOut,
        signInAsGuest,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
