type Part = {
  type: 'literal' | 'element';
  value: string;
};

export function getBasicListFormat() {
  return {
    format: (items: string[]) => items.join(', '),
    formatToParts: (items: string[]): Part[] => {
      const result: Part[] = [];

      items.forEach((item, i) => {
        if (i > 0) {
          result.push({ type: 'literal', value: ', ' });
        }
        result.push({ type: 'element', value: item });
      });

      return result;
    },
  };
}
