import { create } from 'zustand';
import { User, UserRole } from '../types';
import { DEMO_USERS } from '../lib/mock-data';

interface AuthState {
  user: User | null;
  demoUsers: User[];
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    role: UserRole,
    ndpaConsent: boolean
  ) => Promise<void>;
  switchRole: (role: UserRole) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: DEMO_USERS[0], // Default signed in as Admin for instant inspection
  demoUsers: DEMO_USERS,
  isAuthenticated: true,

  login: async (email: string) => {
    const found =
      DEMO_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase()) || DEMO_USERS[0];
    set({ user: found, isAuthenticated: true });
  },

  register: async (name, email, _password, role, ndpaConsent) => {
    if (!ndpaConsent) {
      throw new Error('Explicit NDPA 2023 consent is required to register.');
    }
    const newUser: User = {
      id: `usr-${Date.now()}`,
      name,
      email,
      role,
      ndpa_consent_at: new Date().toISOString(),
    };
    set((state) => ({
      user: newUser,
      demoUsers: [...state.demoUsers, newUser],
      isAuthenticated: true,
    }));
  },

  switchRole: (role: UserRole) => {
    const found = DEMO_USERS.find((u) => u.role === role) || DEMO_USERS[0];
    set({ user: found, isAuthenticated: true });
  },

  logout: () => set({ user: null, isAuthenticated: false }),
}));
