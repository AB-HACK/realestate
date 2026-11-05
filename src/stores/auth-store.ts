import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, UserRole, CompanySettings, NotificationPrefs } from "@/types";
import { mockUsers } from "@/lib/mock-data";

interface AuthState {
  user: User | null;
  users: User[];
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  company: CompanySettings;
  notifPrefs: NotificationPrefs;
  login: (email: string, password: string) => Promise<User>;
  signup: (data: { firstName: string; lastName: string; email: string; password: string }) => Promise<User>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
  updateCompany: (data: Partial<CompanySettings>) => void;
  updateNotifPrefs: (data: Partial<NotificationPrefs>) => void;
  completeOnboarding: () => void;
}

const defaultCompany: CompanySettings = {
  name: "AecrenEstates",
  email: "contact@aecrenestates.com",
  phone: "+1 202-555-0100",
  address: "1200 Market St, Suite 500, Washington DC",
  website: "www.aecrenestates.com",
  description: "Premium real estate agency serving clients nationwide.",
};

const defaultNotifPrefs: NotificationPrefs = {
  emailNotifications: true,
  newLeadAlerts: true,
  appointmentReminders: true,
  propertyUpdates: false,
  weeklyReports: true,
  smsNotifications: false,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      users: mockUsers,
      isAuthenticated: false,
      hasCompletedOnboarding: false,
      company: defaultCompany,
      notifPrefs: defaultNotifPrefs,
      login: async (email: string, _password: string) => {
        const normalizedEmail = email.trim().toLowerCase();
        const allUsers = get().users ?? mockUsers;
        const user = allUsers.find((u) => u.email.toLowerCase() === normalizedEmail);
        if (!user) {
          throw new Error("No account found with that email address.");
        }
        set({ user, isAuthenticated: true, hasCompletedOnboarding: true });
        return user;
      },
      signup: async (data) => {
        const normalizedEmail = data.email.trim().toLowerCase();
        const allUsers = get().users ?? mockUsers;
        if (allUsers.some((u) => u.email.toLowerCase() === normalizedEmail)) {
          throw new Error("An account with this email already exists.");
        }
        const user: User = {
          id: `u-${Date.now()}`,
          email: data.email.trim(),
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          role: "agent",
          createdAt: new Date().toISOString(),
        };
        set({
          user,
          users: [...allUsers, user],
          isAuthenticated: true,
          hasCompletedOnboarding: false,
        });
        return user;
      },
      logout: () => set({ user: null, isAuthenticated: false, hasCompletedOnboarding: false }),
      updateProfile: (data) =>
        set((state) => {
          if (!state.user) return state;
          const updatedUser = { ...state.user, ...data };
          return {
            user: updatedUser,
            users: (state.users ?? mockUsers).map((u) => (u.id === updatedUser.id ? updatedUser : u)),
          };
        }),
      updateCompany: (data) =>
        set((state) => ({ company: { ...state.company, ...data } })),
      updateNotifPrefs: (data) =>
        set((state) => ({ notifPrefs: { ...state.notifPrefs, ...data } })),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
    }),
    { name: "aecren-auth" },
  ),
);

export const roleLabels: Record<UserRole, string> = {
  admin: "Administrator",
  agent: "Agent",
  client: "Client",
};
