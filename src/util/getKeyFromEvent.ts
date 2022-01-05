export default function getKeyFromEvent(e: KeyboardEvent) {
  const key = 'key' in e ? e.key : e.code;

  return key.startsWith('Key') ? key.slice(3).toLowerCase() : key;
}
