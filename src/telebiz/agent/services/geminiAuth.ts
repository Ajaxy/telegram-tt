/**
 * Google Gemini API Key Authentication
 *
 * Gemini uses simple API key authentication.
 * The API key is stored in browser localStorage.
 */

const STORAGE_KEY = 'telebiz_gemini_api_key';

/**
 * Get the stored Gemini API key
 */
export function getGeminiApiKey(): string | undefined {
  return localStorage.getItem(STORAGE_KEY) || undefined;
}

/**
 * Check if Gemini is connected
 */
export function isGeminiConnected(): boolean {
  return Boolean(getGeminiApiKey());
}

/**
 * Save Gemini API key
 */
export function saveGeminiApiKey(apiKey: string): void {
  localStorage.setItem(STORAGE_KEY, apiKey);
}

/**
 * Disconnect Gemini (remove stored API key)
 */
export function disconnectGemini(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Validate the stored API key by making a test request
 */
export async function validateGeminiKey(): Promise<boolean> {
  const key = getGeminiApiKey();
  if (!key) return false;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
    );
    return response.ok;
  } catch {
    return false;
  }
}
