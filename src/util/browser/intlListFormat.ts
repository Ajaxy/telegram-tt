export function getBasicListFormat() {
  return {
    format: (items: string[]) => items.join(', '),
  };
}
