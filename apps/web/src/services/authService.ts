const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: "CUSTOMER" | "ADMIN";
  loyaltyPoints: number;
}

interface LoginResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: AuthUser;
}

export class AuthApiError extends Error {
  readonly code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const data = await response.json().catch(() => null);

    throw new AuthApiError(
      typeof data?.message === "string"
        ? data.message
        : `Yêu cầu thất bại (${response.status}).`,
      typeof data?.code === 'string' ? data.code : undefined,
    );
  }

  return response.json() as Promise<T>;
}

export const authService = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    return readResponse<LoginResponse>(response);
  },

  async googleLogin(credential: string, password?: string): Promise<LoginResponse> {
    const response = await fetch(`${API_URL}/auth/google`, {
     method: "POST",
     headers: {
        "Content-Type": "application/json",
      },
     body: JSON.stringify({ credential, password }),
    });

   return readResponse<LoginResponse>(response);
  },
  async getCurrentUser(token: string): Promise<AuthUser> {
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return readResponse<AuthUser>(response);
  },
};
