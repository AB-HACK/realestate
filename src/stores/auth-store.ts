import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, UserRole } from "@/types";
import { mockUsers } from "@/lib/mock-data";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (data: { firstName: string; lastName: string; email: string; password: string }) => Promise<User>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: async (email: string, _password: string) => {
        const user = mockUsers.find((u) => u.email === email) ?? mockUsers[0];
        set({ user, isAuthenticated: true });
        return user;
      },
      signup: async (data) => {
        const user: User = {
          id: `u-${Date.now()}`,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          role: "client",
          createdAt: new Date().toISOString(),
        };
        set({ user, isAuthenticated: true });
        return user;
      },
      logout: () => set({ user: null, isAuthenticated: false }),
      updateProfile: (data) =>
        set((state) => ({ user: state.user ? { ...state.user, ...data } : null })),
    }),
    { name: "aecren-auth" },
  ),
);

export const roleLabels: Record<UserRole, string> = {
  admin: "Administrator",
  agent: "Agent",
  client: "Client",
};
