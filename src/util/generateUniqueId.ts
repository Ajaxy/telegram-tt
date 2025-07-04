export default function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function generateUniqueNumberId() {
  const timestamp = Date.now() % 100000000;
  const random = Math.floor(Math.random() * 1000);
  return timestamp + random;
}
