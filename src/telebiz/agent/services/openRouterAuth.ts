/**
 * OpenRouter OAuth PKCE Authentication
 * Based on: https://openrouter.ai/docs/guides/overview/auth/oauth
 *
 * This handles the complete OAuth PKCE flow:
 * 1. Generate code verifier and challenge
 * 2. Open popup for OpenRouter auth
 * 3. Exchange authorization code for API key
 * 4. Store API key in browser localStorage
 */

import { IS_OPEN_IN_NEW_TAB_SUPPORTED } from '../../../util/browser/windowEnvironment';
import PopupManager from '../../util/PopupManager';

const OPENROUTER_AUTH_URL = 'https://openrouter.ai/auth';
const OPENROUTER_KEYS_URL = 'https://openrouter.ai/api/v1/auth/keys';
const STORAGE_KEY = 'telebiz_openrouter_key';
const CODE_VERIFIER_KEY = 'telebiz_openrouter_code_verifier';

// Popup management
let oAuthPopupManager: PopupManager | undefined;
let authWindowRef: WindowProxy | undefined;
let pollTimerRef: number | undefined;
let messageListenerRef: ((event: MessageEvent) => void) | undefined;
let pendingAuthCallback: ((result: { success: boolean; error?: string }) => void) | undefined;

/**
 * Generate a cryptographically secure random string for code verifier
 */
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generate SHA-256 code challenge from code verifier
 */
async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hash);
  return btoa(String.fromCharCode(...hashArray))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Get the callback URL for OAuth redirect
 * For popup: uses /oauth-callback/ page that posts message back to opener
 * For redirect: uses current page URL so handleOpenRouterCallback can process it
 */
function getCallbackUrl(usePopupCallback: boolean): string {
  if (usePopupCallback) {
    return `${window.location.origin}/oauth-callback/`;
  }
  // For redirect flow, use current URL
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  return url.toString();
}

/**
 * Clean up OAuth popup resources
 */
function cleanupOAuth(): void {
  if (pollTimerRef) {
    clearInterval(pollTimerRef);
    pollTimerRef = undefined;
  }

  if (messageListenerRef) {
    window.removeEventListener('message', messageListenerRef);
    messageListenerRef = undefined;
  }

  authWindowRef = undefined;
}

/**
 * Pre-open popup before async operations to avoid popup blockers on mobile
 * Call this on user click, before any async work
 */
export function preOpenPopupIfNeeded(): void {
  if (!IS_OPEN_IN_NEW_TAB_SUPPORTED) return;

  if (!oAuthPopupManager) {
    oAuthPopupManager = new PopupManager(
      'width=600,height=700,scrollbars=yes,resizable=yes',
      () => {},
    );
  }

  oAuthPopupManager.preOpenIfNeeded();
}

/**
 * Start the OpenRouter OAuth PKCE flow in a popup
 * Returns a promise that resolves when auth is complete
 */
export async function startOpenRouterAuth(): Promise<{ success: boolean; error?: string }> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Store code verifier for later use when exchanging the code
  sessionStorage.setItem(CODE_VERIFIER_KEY, codeVerifier);

  // Use popup callback page for desktop, current page for mobile redirect
  const usePopup = IS_OPEN_IN_NEW_TAB_SUPPORTED;
  const callbackUrl = getCallbackUrl(usePopup);

  const authUrl = new URL(OPENROUTER_AUTH_URL);
  authUrl.searchParams.set('callback_url', callbackUrl);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  cleanupOAuth();

  // If popup not supported, redirect (mobile browsers)
  if (!usePopup) {
    window.location.href = authUrl.toString();
    return { success: false, error: 'Redirecting...' };
  }

  return new Promise((resolve) => {
    pendingAuthCallback = resolve;

    // Listen for OAuth callback message from popup (sent by /oauth-callback/ page)
    const handleOAuthMessage = async (event: MessageEvent) => {
      // Only accept messages from same origin
      if (event.origin !== window.location.origin) return;

      // Handle the callback from /oauth-callback/ page
      if (event.data?.type === 'OAUTH_CALLBACK') {
        cleanupOAuth();

        // Check for errors first (user denied, etc.)
        if (event.data.error || !event.data.success) {
          const errorMsg = event.data.error || 'Authorization was denied or cancelled';
          pendingAuthCallback?.({ success: false, error: errorMsg });
          pendingAuthCallback = undefined;
          return;
        }

        // Try to exchange the code
        const code = event.data.params?.code;
        if (code) {
          const result = await handleCodeExchange(code);
          pendingAuthCallback?.(result);
          pendingAuthCallback = undefined;
        } else {
          pendingAuthCallback?.({ success: false, error: 'No authorization code received' });
          pendingAuthCallback = undefined;
        }
      }
    };

    messageListenerRef = handleOAuthMessage;
    window.addEventListener('message', handleOAuthMessage);

    try {
      // Use PopupManager if available (handles pre-opened popup on mobile)
      if (oAuthPopupManager) {
        oAuthPopupManager.open(authUrl.toString());
      } else {
        authWindowRef = window.open(
          authUrl.toString(),
          'openrouter-oauth',
          'width=600,height=700,scrollbars=yes,resizable=yes',
        ) || undefined;
      }

      // If neither worked, fallback to redirect
      if (!oAuthPopupManager && !authWindowRef) {
        cleanupOAuth();
        window.location.href = authUrl.toString();
        resolve({ success: false, error: 'Redirecting...' });
        return;
      }

      // Poll to check if popup was closed without completing auth
      pollTimerRef = window.setInterval(async () => {
        try {
          // Check if popup closed
          if (authWindowRef?.closed) {
            cleanupOAuth();
            // Check if we got a code in the callback URL (fallback)
            if (isOpenRouterCallback()) {
              const result = await handleOpenRouterCallback();
              pendingAuthCallback?.(result);
            } else {
              pendingAuthCallback?.({ success: false, error: 'Authentication cancelled' });
            }
            pendingAuthCallback = undefined;
          }
        } catch {
          // Cross-origin errors are expected, ignore
        }
      }, 1000);

      // Timeout after 5 minutes
      setTimeout(() => {
        if (pendingAuthCallback) {
          cleanupOAuth();
          pendingAuthCallback({ success: false, error: 'Authentication timed out' });
          pendingAuthCallback = undefined;
        }
      }, 300000);
    } catch {
      cleanupOAuth();
      // Fallback to redirect
      window.location.href = authUrl.toString();
      resolve({ success: false, error: 'Redirecting...' });
    }
  });
}

/**
 * Handle code exchange after OAuth callback
 */
async function handleCodeExchange(code: string): Promise<{ success: boolean; error?: string }> {
  const codeVerifier = sessionStorage.getItem(CODE_VERIFIER_KEY);
  if (!codeVerifier) {
    return { success: false, error: 'No code verifier found. Please try connecting again.' };
  }

  return exchangeCodeForKey(code, codeVerifier);
}

/**
 * Handle the OAuth callback - exchange code for API key
 * Call this when the user is redirected back from OpenRouter
 */
export async function handleOpenRouterCallback(): Promise<{ success: boolean; error?: string }> {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');

  if (!code) {
    return { success: false, error: 'No authorization code found in URL' };
  }

  const codeVerifier = sessionStorage.getItem(CODE_VERIFIER_KEY);
  if (!codeVerifier) {
    return { success: false, error: 'No code verifier found. Please try connecting again.' };
  }

  try {
    const response = await fetch(OPENROUTER_KEYS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        code_verifier: codeVerifier,
        code_challenge_method: 'S256',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`;
      return { success: false, error: `Failed to exchange code: ${errorMessage}` };
    }

    const { key } = await response.json();

    if (!key) {
      return { success: false, error: 'No API key returned from OpenRouter' };
    }

    // Store the API key securely in localStorage
    localStorage.setItem(STORAGE_KEY, key);

    // Clean up code verifier
    sessionStorage.removeItem(CODE_VERIFIER_KEY);

    // Clean up URL parameters
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to connect: ${message}` };
  }
}

/**
 * Check if we're on the OAuth callback page (has code param in URL)
 */
export function isOpenRouterCallback(): boolean {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.has('code');
}

/**
 * Check if we're in a popup and should send message to opener
 * Call this on page load to handle OAuth callback in popup
 */
export function checkAndHandlePopupCallback(): boolean {
  if (!isOpenRouterCallback()) return false;

  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');

  // If we have an opener (we're in a popup), send message and close
  if (window.opener && code) {
    try {
      window.opener.postMessage(
        { type: 'OPENROUTER_CALLBACK', code },
        window.location.origin,
      );
      // Clean URL and close popup
      window.close();
      return true;
    } catch {
      // If postMessage fails, fall through to handle normally
    }
  }

  return false;
}

/**
 * Manually exchange a code for an API key (for testing/debugging)
 * Use this if the automatic callback handling didn't work
 */
export async function exchangeCodeForKey(
  code: string,
  codeVerifier?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const body: Record<string, string> = { code };

    // If we have a code verifier from the PKCE flow, include it
    if (codeVerifier) {
      body.code_verifier = codeVerifier;
      body.code_challenge_method = 'S256';
    }

    const response = await fetch(OPENROUTER_KEYS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`;
      return { success: false, error: `Failed to exchange code: ${errorMessage}` };
    }

    const { key } = await response.json();

    if (!key) {
      return { success: false, error: 'No API key returned from OpenRouter' };
    }

    // Store the API key
    localStorage.setItem(STORAGE_KEY, key);

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to exchange code: ${message}` };
  }
}

/**
 * Get the stored OpenRouter API key
 */
export function getOpenRouterApiKey(): string | undefined {
  return localStorage.getItem(STORAGE_KEY) || undefined;
}

/**
 * Check if OpenRouter is connected
 */
export function isOpenRouterConnected(): boolean {
  return Boolean(getOpenRouterApiKey());
}

/**
 * Disconnect OpenRouter (remove stored API key)
 */
export function disconnectOpenRouter(): void {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(CODE_VERIFIER_KEY);
}

/**
 * Validate the stored API key by making a test request
 */
export async function validateOpenRouterKey(): Promise<boolean> {
  const key = getOpenRouterApiKey();
  if (!key) return false;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}
