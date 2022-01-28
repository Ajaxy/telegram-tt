type Parts = (string | false | undefined)[];

export default function buildClassName(...parts: Parts) {
  return parts.filter(Boolean).join(' ');
}

export function createClassNameBuilder(componentName: string) {
  return (elementName: string, ...modifiers: Parts) => {
    const baseName = elementName === '&' ? componentName : `${componentName}__${elementName}`;

    return modifiers.reduce((acc, modifier) => {
      if (modifier) {
        acc.push(`${baseName}--${modifier}`);
      }

      return acc;
    }, [baseName]).join(' ');
  };
}
