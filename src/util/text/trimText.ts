export default function trimText<T extends string | undefined>(text: T, length?: number) {
  if (!text || !length || text.length <= length) {
    return text;
  }

  return `${text.substring(0, length)}...`;
}
