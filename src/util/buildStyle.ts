type Parts = (string | false | undefined)[];

export default function buildStyle(...parts: Parts) {
  return parts.filter(Boolean).join(';');
}
