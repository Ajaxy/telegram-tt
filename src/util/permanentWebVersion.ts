const PERMANENT_VERSION_KEY = 'kz_version';
const AVAILABLE_VERSIONS = ['Z', 'K'] as const;

export function setPermanentWebVersion(version: typeof AVAILABLE_VERSIONS[number]) {
  localStorage.setItem(PERMANENT_VERSION_KEY, JSON.stringify(version));
}
