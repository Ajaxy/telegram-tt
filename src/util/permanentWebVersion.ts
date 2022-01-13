const PERMANENT_VERSION_KEY = 'kz_version';
const AVAILABLE_VERSIONS = ['Z', 'K'] as const;
const DEFAULT_VERSION = 'Z';

export function setPermanentWebVersion(version: typeof AVAILABLE_VERSIONS[number]) {
  localStorage.setItem(PERMANENT_VERSION_KEY, JSON.stringify(version));
}

export function ensurePermanentWebVersion() {
  if (!hasPermanentWebVersion()) {
    setPermanentWebVersion(DEFAULT_VERSION);
  }
}

function hasPermanentWebVersion() {
  const json = localStorage.getItem(PERMANENT_VERSION_KEY);
  if (!json) {
    return false;
  }

  try {
    const version = JSON.parse(json);
    return AVAILABLE_VERSIONS.includes(version);
  } catch (err) {
    return false;
  }
}
