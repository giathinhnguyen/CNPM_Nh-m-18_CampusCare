import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  authService,
  type AuthUser,
} from "../services/authService";

import { TOKEN_KEY, SESSION_EXPIRED, tokenExpiresAt, expireSession } from "../services/session";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  googleLogin: (credential: string, password?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;

}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        const token = localStorage.getItem(TOKEN_KEY);

        if (!token) return;

        const currentUser = await authService.getCurrentUser();

        if (active && localStorage.getItem(TOKEN_KEY) === token) {
          setUser(currentUser);
        }
      } catch {
        if (active) {
          // authenticatedFetch clears rejected credentials. Keep the token on
          // temporary network/server failures so a reload can retry the session.
          setUser(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void restoreSession();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const clear = () => setUser(null);
    const sync = (event: StorageEvent) => {
      if (event.key === TOKEN_KEY || event.key === null) window.location.reload();
    };
    window.addEventListener(SESSION_EXPIRED, clear);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SESSION_EXPIRED, clear);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    const check = () => {
      if (tokenExpiresAt(token) <= Date.now()) expireSession(token);
    };
    const timer = window.setTimeout(check, Math.max(0, tokenExpiresAt(token) - Date.now()));
    window.addEventListener("focus", check);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", check);
    };
  }, [user]);

  async function login(email: string, password: string) {
    const result = await authService.login(email, password);

    localStorage.setItem(TOKEN_KEY, result.accessToken);
    setUser(result.user);
  }
  async function googleLogin(credential: string, password?: string) {
    const result = await authService.googleLogin(credential, password);

    localStorage.setItem(TOKEN_KEY, result.accessToken);
    setUser(result.user);
  }
  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }

  async function refreshUser() {
    const token = localStorage.getItem(TOKEN_KEY);
    const currentUser = await authService.getCurrentUser();
    if (token && localStorage.getItem(TOKEN_KEY) === token) setUser(currentUser);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, googleLogin, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth phải được sử dụng bên trong AuthProvider.");
  }

  return context;
}
