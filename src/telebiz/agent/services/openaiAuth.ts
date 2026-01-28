/**
 * OpenAI API Key Authentication
 *
 * OpenAI uses simple API key authentication.
 * The API key is stored in browser localStorage.
 */

const STORAGE_KEY = 'telebiz_openai_api_key';

/**
 * Get the stored OpenAI API key
 */
export function getOpenAIApiKey(): string | undefined {
  return localStorage.getItem(STORAGE_KEY) || undefined;
}

/**
 * Check if OpenAI is connected
 */
export function isOpenAIConnected(): boolean {
  return Boolean(getOpenAIApiKey());
}

/**
 * Save OpenAI API key
 */
export function saveOpenAIApiKey(apiKey: string): void {
  localStorage.setItem(STORAGE_KEY, apiKey);
}

/**
 * Disconnect OpenAI (remove stored API key)
 */
export function disconnectOpenAI(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Validate the stored API key by making a test request
 */
export async function validateOpenAIKey(): Promise<boolean> {
  const key = getOpenAIApiKey();
  if (!key) return false;

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}
