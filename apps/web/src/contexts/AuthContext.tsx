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

const TOKEN_KEY = "brewlite_access_token";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  googleLogin: (credential: string, password?: string) => Promise<void>;
  logout: () => void;

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

        const currentUser = await authService.getCurrentUser(token);

        if (active) {
          setUser(currentUser);
        }
      } catch {
        if (active) {
          localStorage.removeItem(TOKEN_KEY);
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

  return (
    <AuthContext.Provider value={{ user, loading, login, googleLogin, logout }}>
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
