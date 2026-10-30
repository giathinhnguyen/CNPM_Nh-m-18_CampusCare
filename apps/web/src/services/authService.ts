import { authenticatedFetch } from "./session";

const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: "CUSTOMER" | "ADMIN";
  loyaltyPoints: number;
  hasPassword: boolean;
}

interface LoginResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: AuthUser;
}

export class AuthApiError extends Error {
  readonly code?: string;
  readonly retryAfter?: number;
  constructor(message: string, code?: string, retryAfter?: number) {
    super(message);
    this.code = code;
    this.retryAfter = retryAfter;
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
      typeof data?.retryAfter === 'number' ? data.retryAfter : undefined,
    );
  }

  return response.json() as Promise<T>;
}

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface RegistrationChallenge {
  message: string;
  registrationId: string;
  email: string;
  expiresAt: string;
  resendAfter: number;
}

export interface PasswordSetupChallenge {
  challengeId: string;
  email: string;
  expiresAt: string;
  resendAfter: number;
  message: string;
}

interface RegisterResponse {
  message: string;
  user: {
    id: string;
    fullName: string;
    email: string;
  };
}

export const authService = {
  async requestPasswordSetup(): Promise<PasswordSetupChallenge> {
    return readResponse<PasswordSetupChallenge>(await authenticatedFetch(`${API_URL}/auth/password-setup/request`, { method: "POST" }));
  },

  async confirmPasswordSetup(challengeId: string, code: string, password: string, confirmPassword: string): Promise<{ message: string }> {
    return readResponse<{ message: string }>(await authenticatedFetch(`${API_URL}/auth/password-setup/confirm`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId, code, password, confirmPassword }),
    }));
  },
  async register(input: RegisterInput): Promise<RegistrationChallenge> {
    let response: Response;

    try {
      response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });
    } catch {
      throw new Error(
        "Không thể kết nối máy chủ. Vui lòng thử lại.",
      );
    }

    return readResponse<RegistrationChallenge>(response);
  },

  async verifyEmail(registrationId: string, code: string): Promise<RegisterResponse> {
    return readResponse<RegisterResponse>(await fetch(`${API_URL}/auth/verify-email`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registrationId, code }),
    }));
  },

  async resendVerification(registrationId: string): Promise<RegistrationChallenge> {
    return readResponse<RegistrationChallenge>(await fetch(`${API_URL}/auth/resend-verification`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registrationId }),
    }));
  },

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
  async getCurrentUser(): Promise<AuthUser> {
    const response = await authenticatedFetch(`${API_URL}/auth/me`);

    return readResponse<AuthUser>(response);
  },
};
