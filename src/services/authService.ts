import { AuthResponse, TokenResponse } from '../types';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

class AuthService {
  private getHeaders() {
    const token = localStorage.getItem('anilust_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async signup(data: { username: string; email: string; password: string }): Promise<AuthResponse> {
    const url = BACKEND_URL ? `${BACKEND_URL}/api/auth/signup` : '/api/auth/signup';
    
    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    const json = await res.json();
    
    if (!res.ok) {
      throw new Error(json.error || 'Signup failed');
    }

    if (json.token) {
      localStorage.setItem('anilust_token', json.token);
    }
    
    if (json.user) {
      localStorage.setItem('anilust_current_user', JSON.stringify(json.user));
    }

    return json;
  }

  async login(data: { email: string; password: string }): Promise<AuthResponse> {
    const url = BACKEND_URL ? `${BACKEND_URL}/api/auth/login` : '/api/auth/login';
    
    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    const json = await res.json();
    
    if (!res.ok) {
      throw new Error(json.error || 'Login failed');
    }

    if (json.token) {
      localStorage.setItem('anilust_token', json.token);
    }
    
    if (json.user) {
      localStorage.setItem('anilust_current_user', JSON.stringify(json.user));
    }

    return json;
  }

  async verifyToken(): Promise<TokenResponse> {
    const token = localStorage.getItem('anilust_token');
    
    if (!token) {
      return { valid: false };
    }

    const url = BACKEND_URL ? `${BACKEND_URL}/api/auth/verify` : '/api/auth/verify';
    
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ token }),
      });

      const json = await res.json();
      return res.ok ? json : { valid: false };
    } catch {
      return { valid: false };
    }
  }

  logout() {
    localStorage.removeItem('anilust_token');
    localStorage.removeItem('anilust_current_user');
    localStorage.removeItem('anilust_saved_email');
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('anilust_token');
  }

  getToken(): string | null {
    return localStorage.getItem('anilust_token');
  }

  getUser() {
    const saved = localStorage.getItem('anilust_current_user');
    return saved ? JSON.parse(saved) : null;
  }
}

export const authService = new AuthService();
