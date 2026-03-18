"use client";

import { create } from "zustand";
import api from "@/lib/api";
import type { User, LoginDto, RegisterDto, AuthResponse } from "@/types";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (dto: LoginDto) => Promise<void>;
  register: (dto: RegisterDto) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (dto: LoginDto) => {
    const { data } = await api.post<AuthResponse>("/auth/login", dto);
    localStorage.setItem("access_token", data.accessToken);
    set({ user: data.user, isAuthenticated: true });
  },

  register: async (dto: RegisterDto) => {
    const { data } = await api.post<AuthResponse>("/auth/register", dto);
    localStorage.setItem("access_token", data.accessToken);
    set({ user: data.user, isAuthenticated: true });
  },

  logout: async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      localStorage.removeItem("access_token");
      set({ user: null, isAuthenticated: false });
    }
  },

  fetchUser: async () => {
    try {
      const { data } = await api.get<User>("/auth/me");
      set({ user: data, isAuthenticated: true, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
