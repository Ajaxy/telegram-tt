type Parts = (string | false | undefined)[];
type PartsWithGlobals = (string | false | undefined | string[])[];
type ClassNameBuilder =
  ((elementName: string, ...modifiers: PartsWithGlobals) => string)
  & Record<string, string>;

export default function buildClassName(...parts: Parts) {
  return parts.filter(Boolean).join(' ');
}

export function createClassNameBuilder(componentName: string) {
  return ((elementName: string, ...modifiers: PartsWithGlobals) => {
    const baseName = elementName === '&' ? componentName : `${componentName}__${elementName}`;

    return modifiers.reduce<string[]>((acc, modifier) => {
      if (modifier) {
        // A bit hacky way to pass global class names
        if (Array.isArray(modifier)) {
          acc.push(...modifier);
        } else {
          acc.push(`${baseName}--${modifier}`);
        }
      }

      return acc;
    }, [baseName]).join(' ');
  }) as ClassNameBuilder;
}
