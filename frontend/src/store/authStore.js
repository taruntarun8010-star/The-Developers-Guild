import { create } from 'zustand';

// Helper to safely parse JSON from localStorage
const getJSON = (key) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch {
    return null;
  }
};

// Get API base URL from environment or global config
const API_BASE_URL = (window.__DG_API_BASE_URL__ || import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'https://the-developers-guild.onrender.com').replace(/\/$/, '');

export const useAuthStore = create((set) => ({
  user: getJSON('user'),
  token: localStorage.getItem('token'),
  adminUser: getJSON('adminSession'),
  adminToken: localStorage.getItem('adminToken'),

  setUser: (user, token) => {
    localStorage.setItem('user', JSON.stringify(user));
    if (token) localStorage.setItem('token', token);
    set({ user, token: token || localStorage.getItem('token') });
  },

  setAdmin: (adminUser, adminToken) => {
    localStorage.setItem('adminSession', JSON.stringify(adminUser));
    if (adminToken) localStorage.setItem('adminToken', adminToken);
    set({ adminUser, adminToken: adminToken || localStorage.getItem('adminToken') });
  },

  refreshUserSession: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return false;
      const data = await res.json();
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);
      set({ user: data.user, token: data.token });
      return true;
    } catch {
      return false;
    }
  },

  refreshAdminSession: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return false;
      const data = await res.json();
      localStorage.setItem('adminSession', JSON.stringify(data.admin));
      localStorage.setItem('adminToken', data.token);
      set({ adminUser: data.admin, adminToken: data.token });
      return true;
    } catch {
      return false;
    }
  },

  logoutUser: () => {
    fetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },

  logoutAdmin: () => {
    fetch(`${API_BASE_URL}/api/admin/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    localStorage.removeItem('adminSession');
    localStorage.removeItem('adminToken');
    set({ adminUser: null, adminToken: null });
  }
}));

