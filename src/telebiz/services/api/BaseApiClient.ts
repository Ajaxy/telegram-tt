import type { TelebizApiConfig, TelebizApiError, TelebizAuthResponse, TelebizUser } from '../types';

import { API_URL, DEBUG } from '../../../config';
import { TelebizStorageKey } from '../../config/storageKeys';
import { logDebugMessage } from '../../../util/debugConsole';
import storage from '../../util/storage';

// Default configuration
const DEFAULT_CONFIG: TelebizApiConfig = {
  baseUrl: API_URL,
  timeout: 30000,
  retryAttempts: 3,
  debug: DEBUG,
};

/**
 * Base Telebiz API Client
 * Handles authentication, request management, and common functionality
 */
export abstract class BaseApiClient {
  protected config: TelebizApiConfig;
  protected token: string | undefined = undefined;
  protected refreshToken: string | undefined = undefined;
  protected tokenExpiry: number | undefined = undefined;
  protected refreshPromise: Promise<void> | undefined = undefined;

  constructor(config: Partial<TelebizApiConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadTokensFromStorage();
  }

  /**
   * Authenticate with JWT token received from bot
   */
  async authenticateWithJWT(jwtToken: string): Promise<TelebizAuthResponse> {
    const response = await this.request<{
      status: string;
      data: {
        user: TelebizUser;
        token: string;
      };
    }>('/auth/jwt', {
      method: 'POST',
      body: JSON.stringify({
        token: jwtToken,
      }),
      skipAuth: true,
    });

    if (response.status !== 'success' || !response.data) {
      throw new Error('JWT authentication failed');
    }

    const oneYearInSeconds = 60 * 60 * 24 * 365;
    this.setTokens(response.data.token, response.data.token, oneYearInSeconds);

    return {
      token: response.data.token,
      refreshToken: response.data.token,
      expiresIn: oneYearInSeconds,
      user: response.data.user,
    };
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<TelebizUser> {
    const response = await this.request<{
      status: string;
      data: { user: TelebizUser };
    }>('/auth/me');

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to get current user');
    }

    return response.data.user;
  }

  /**
   * Refresh authentication token
   */
  async refreshAuthToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    if (this.refreshPromise) {
      await this.refreshPromise;
      return;
    }

    this.refreshPromise = this.performTokenRefresh();
    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = undefined;
    }
  }

  /**
   * Logout and clear tokens
   */
  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch (error) {
      // Ignore logout errors
    } finally {
      this.clearTokens();
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return Boolean(this.token) && !this.isTokenExpired();
  }

  /**
   * Get current token
   */
  getToken(): string | undefined {
    return this.token;
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await this.request<{
      status: string;
      data: { status: string; timestamp: string };
    }>('/health', { skipAuth: true });

    return response.data;
  }

  /**
   * Make authenticated request to API
   */
  protected async request<T>(
    endpoint: string,
    options: {
      method?: string;
      body?: BodyInit | null;
      headers?: Record<string, string>;
      skipAuth?: boolean;
      timeout?: number;
    } = {},
  ): Promise<T> {
    const {
      method = 'GET',
      body,
      headers = {},
      skipAuth = false,
      timeout = this.config.timeout,
    } = options;

    const url = `${this.config.baseUrl}${endpoint}`;
    const requestHeaders: Record<string, string> = {
      ...headers,
    };

    // Set default JSON Content-Type ONLY when sending a non-FormData body and header not provided
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    if (body && !isFormData && !requestHeaders['Content-Type']) {
      requestHeaders['Content-Type'] = 'application/json';
    }

    // Add authentication header if not skipped
    if (!skipAuth) {
      // Reload tokens from storage if we don't have one in memory
      if (!this.token) {
        this.loadTokensFromStorage();
      }
      if (!this.token) {
        throw new Error('No authentication token available');
      }

      if (this.isTokenExpired()) {
        await this.refreshAuthToken();
      }

      requestHeaders.Authorization = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error: TelebizApiError = {
          message: errorData.message || `HTTP ${response.status}`,
          code: errorData.code || 'HTTP_ERROR',
          status: response.status,
        };

        if (this.config.debug) {
          logDebugMessage('error', 'API Error:', error);
        }

        throw new Error(error.message);
      }

      const data = await response.json();

      if (this.config.debug) {
        logDebugMessage('log', 'API Response:', { endpoint, data });
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout');
        }
        throw error;
      }

      if (typeof error === 'object' && error && 'message' in error) {
        throw error;
      }

      throw new Error('Unknown error occurred');
    }
  }

  /**
   * Perform token refresh
   */
  private async performTokenRefresh(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await this.request<{
        status: string;
        data: {
          token: string;
          refreshToken: string;
          expiresIn: number;
        };
      }>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({
          refreshToken: this.refreshToken,
        }),
        skipAuth: true,
      });

      if (response.status !== 'success' || !response.data) {
        throw new Error('Token refresh failed');
      }

      this.setTokens(
        response.data.token,
        response.data.refreshToken,
        response.data.expiresIn,
      );
    } catch (error) {
      this.clearTokens();
      throw error;
    }
  }

  /**
   * Set authentication tokens
   */
  protected setTokens(token: string, refreshToken: string, expiresIn: number): void {
    this.token = token;
    this.refreshToken = refreshToken;
    this.tokenExpiry = Date.now() + expiresIn * 1000;

    storage.set(TelebizStorageKey.Token, token);
    storage.set(TelebizStorageKey.RefreshToken, refreshToken);
    storage.set(TelebizStorageKey.TokenExpiry, this.tokenExpiry.toString());
  }

  /**
   * Clear authentication tokens
   */
  protected clearTokens(): void {
    this.token = undefined;
    this.refreshToken = undefined;
    this.tokenExpiry = undefined;

    storage.remove(TelebizStorageKey.Token);
    storage.remove(TelebizStorageKey.RefreshToken);
    storage.remove(TelebizStorageKey.TokenExpiry);
  }

  /**
   * Load tokens from storage
   */
  private loadTokensFromStorage(): void {
    try {
      const token = storage.get(TelebizStorageKey.Token, undefined);
      const refreshToken = storage.get(TelebizStorageKey.RefreshToken, undefined);
      const tokenExpiry = storage.get(TelebizStorageKey.TokenExpiry, undefined);

      if (token && refreshToken && tokenExpiry) {
        const expiry = parseInt(tokenExpiry, 10);
        if (expiry > Date.now()) {
          this.token = token;
          this.refreshToken = refreshToken;
          this.tokenExpiry = expiry;
        } else {
          this.clearTokens();
        }
      }
    } catch (error) {
      logDebugMessage('warn', 'Failed to load tokens from localStorage:', error);
    }
  }

  /**
   * Check if token is expired
   */
  private isTokenExpired(): boolean {
    return !this.tokenExpiry || this.tokenExpiry <= Date.now();
  }
}
