import type { DiffObject } from './deepDiff';

import { isLiteralObject, unique } from './iteratees';

export function deepMerge<T extends object>(value1: T, value2: DiffObject<T>): T {
  if (value1 === value2) {
    return value2 as unknown as T;
  }

  if (!isLiteralObject(value2)) {
    return value2;
  }

  if (!isLiteralObject(value1)) {
    return reduceDiff(value2) as T;
  }

  if ('__deleteAllChildren' in value2) {
    return {} as T;
  }

  const allKeys = unique(Object.keys(value1).concat(Object.keys(value2)));

  return allKeys.reduce((acc: AnyLiteral, key) => {
    const oldValue = (value1 as AnyLiteral)[key];

    if (!value2.hasOwnProperty(key)) {
      acc[key] = oldValue;
    } else {
      const newValue = value2[key];

      if (!newValue?.__delete) {
        acc[key] = deepMerge(oldValue, newValue);
      }
    }

    return acc;
  }, {}) as T;
}

function reduceDiff(diff: AnyLiteral) {
  if (diff.__deleteAllChildren) {
    return {};
  }

  return Object.entries(diff).reduce((acc: AnyLiteral, [key, value]) => {
    if (!value?.__delete) {
      acc[key] = isLiteralObject(value) ? reduceDiff(value) : value;
    }

    return acc;
  }, {});
}
