import { api } from "./api.js";
import type { SessionRole } from "./types.js";

export interface LoginResponse {
  readonly ok: true;
  readonly username: string;
  readonly role: SessionRole;
}

export const login = (username: string, password: string): Promise<LoginResponse> =>
  api.post<LoginResponse>("/auth/login", { username, password });

export const logout = (): Promise<{ ok: true }> => api.post<{ ok: true }>("/auth/logout");
