import { omit } from './iteratees';

export function deepMerge<T extends any>(value1: T, value2: Partial<T>): T {
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
  const keys = Object.keys(object2);
  // eslint-disable-next-line no-underscore-dangle
  const keysDeleted = keys.filter((k) => object2[k]?.__delete);
  // eslint-disable-next-line no-underscore-dangle
  const keysNotDeleted = keys.filter((k) => !object2[k]?.__delete);
  return keysNotDeleted.reduce((acc: any, key) => {
    acc[key] = deepMerge(object1[key], object2[key]);

    return acc;
  }, { ...omit(object1, keysDeleted) });
}
