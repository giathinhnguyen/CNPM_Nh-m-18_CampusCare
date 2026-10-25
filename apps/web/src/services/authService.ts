const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
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
  async register(input: RegisterInput): Promise<RegisterResponse> {
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

    if (!response.ok) {
      const error = await response.json().catch(() => null);

      throw new Error(
        typeof error?.message === "string"
          ? error.message
          : "Đăng ký thất bại. Vui lòng thử lại.",
      );
    }

    return response.json() as Promise<RegisterResponse>;
  },
};