export default function getKeyFromEvent(e: KeyboardEvent) {
  const key = e.key || e.code;

  return key.startsWith('Key') ? key.slice(3).toLowerCase() : key;
}
