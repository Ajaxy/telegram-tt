export function buildQueryString(data: Record<string, string>) {
  const query = Object.keys(data).map((k) => `${k}=${data[k]}`).join('&');
  return query.length > 0 ? `?${query}` : '';
}
