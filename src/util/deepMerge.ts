import { unique } from './iteratees';

export function deepMerge<T extends any>(value1: T, value2: Record<keyof T, any>): T {
  const type1 = typeof value1;
  const type2 = typeof value2;
  if (type1 !== 'object') {
    return value2 as T;
  }

  if (Array.isArray(value2)) {
    return value2 as T;
  }

  if (type1 !== type2) {
    return value2 as T;
  }

  if (value1 === value2) {
    return value2 as T;
  }

  const object1 = value1 as AnyLiteral;
  const object2 = value2 as AnyLiteral;

  // eslint-disable-next-line no-underscore-dangle
  if (object2.__deleteAllChildren) {
    return {} as T;
  }

  const allKeys = unique(Object.keys(object1).concat(Object.keys(object2)));

  return allKeys.reduce((acc: AnyLiteral, key) => {
    const oldValue = object1[key];

    if (!(key in object2)) {
      acc[key] = oldValue;
    } else {
      const newValue = object2[key];
      // eslint-disable-next-line no-underscore-dangle
      if (!newValue?.__delete) {
        acc[key] = deepMerge(oldValue, newValue);
      }
    }

    return acc;
  }, {}) as T;
}
