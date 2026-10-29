import { AuthResponse, TokenResponse } from '../types';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
const IS_PRODUCTION = import.meta.env.PROD;
const HAS_BACKEND = BACKEND_URL.length > 0 && !BACKEND_URL.includes('localhost');

class AuthService {
  private getHeaders() {
    const token = localStorage.getItem('anilust_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    if (!HAS_BACKEND) {
      // No backend configured - return demo mode response
      console.warn('[Auth] No backend configured, running in demo mode');
      throw new Error('Auth unavailable: No backend configured. Set VITE_BACKEND_URL to enable auth.');
    }

    const url = `${BACKEND_URL}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers: { ...this.getHeaders(), ...options.headers },
    });

    const json = await res.json().catch(() => ({}));
    
    if (!res.ok) {
      throw new Error(json.error || `Request failed: ${res.status}`);
    }
    return json;
  }

  async signup(data: { username: string; email: string; password: string }): Promise<AuthResponse> {
    const json = await this.request('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (json.token) localStorage.setItem('anilust_token', json.token);
    if (json.user) localStorage.setItem('anilust_current_user', JSON.stringify(json.user));

    return json;
  }

  async login(data: { email: string; password: string }): Promise<AuthResponse> {
    const json = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (json.token) localStorage.setItem('anilust_token', json.token);
    if (json.user) localStorage.setItem('anilust_current_user', JSON.stringify(json.user));

    return json;
  }

  async verifyToken(): Promise<TokenResponse> {
    const token = localStorage.getItem('anilust_token');
    
    if (!token) return { valid: false };
    if (!HAS_BACKEND) {
      // Demo mode: trust localStorage token
      const user = this.getUser();
      return user ? { valid: true, user: user as any } : { valid: false };
    }

    try {
      const json = await this.request('/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      return json.valid ? json : { valid: false };
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

  // Demo mode helper - creates a local-only account
  createDemoAccount(username: string, email: string): AuthResponse {
    const user = {
      id: `demo_${Date.now()}`,
      username,
      email,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=a855f7&color=fff&bold=true`,
      role: 'Member',
    };
    const token = `demo_${btoa(JSON.stringify(user))}`;
    
    localStorage.setItem('anilust_token', token);
    localStorage.setItem('anilust_current_user', JSON.stringify(user));
    
    return { message: 'Demo account created', user, token, expiresIn: '7d' };
  }
}

export const authService = new AuthService();
export { HAS_BACKEND };