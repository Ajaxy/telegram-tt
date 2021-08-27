export function formatCardExpiry(input: string) {
  input = input.replace(/[^\d]/g, '').slice(0, 4);
  const parts = input.match(/.{1,2}/g);
  if (parts?.[0] && Number(parts[0]) > 12) {
    parts[0] = '12';
  }
  if (parts?.[0] && parts[0].length === 2 && !parts[1]) {
    parts[1] = '';
  }
  return parts ? parts.join('/') : '';
}

export function formatCardNumber(input: string) {
  input = input.replace(/[^\d]/g, '');
  const parts = input.match(/.{1,4}/g);
  return parts ? parts.join(' ') : '';
}
