import { create } from 'zustand';
import { User } from '../types';

interface AuthState {
  token: string | null;
  user: User | null;
  setSession: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('atendeflow_token'),
  user: JSON.parse(localStorage.getItem('atendeflow_user') || 'null'),
  setSession: (token, user) => {
    localStorage.setItem('atendeflow_token', token);
    localStorage.setItem('atendeflow_user', JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem('atendeflow_token');
    localStorage.removeItem('atendeflow_user');
    set({ token: null, user: null });
  },
}));
