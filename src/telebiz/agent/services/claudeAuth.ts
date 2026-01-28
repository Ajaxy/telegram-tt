/**
 * Claude API Key Authentication
 *
 * Claude uses simple API key authentication.
 * The API key is stored in browser localStorage.
 */

const STORAGE_KEY = 'telebiz_claude_api_key';

/**
 * Get the stored Claude API key
 */
export function getClaudeApiKey(): string | undefined {
  return localStorage.getItem(STORAGE_KEY) || undefined;
}

/**
 * Check if Claude is connected
 */
export function isClaudeConnected(): boolean {
  return Boolean(getClaudeApiKey());
}

/**
 * Save Claude API key
 */
export function saveClaudeApiKey(apiKey: string): void {
  localStorage.setItem(STORAGE_KEY, apiKey);
}

/**
 * Disconnect Claude (remove stored API key)
 */
export function disconnectClaude(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Validate the stored API key by making a test request
 */
export async function validateClaudeKey(): Promise<boolean> {
  const key = getClaudeApiKey();
  if (!key) return false;

  try {
    // Use a simple models endpoint to validate the key
    const response = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}
