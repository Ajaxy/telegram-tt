import { isLiteralObject, unique } from './iteratees';

export function deepMerge<T extends any>(value1: T, value2: T): T {
  if (value1 === value2) {
    return value2;
  }

  if (!isLiteralObject(value2)) {
    return value2;
  }

  if (!isLiteralObject(value1)) {
    return reduceDiff(value2) as T;
  }

  // eslint-disable-next-line no-underscore-dangle
  if (value2.__deleteAllChildren) {
    return {} as T;
  }

  const allKeys = unique(Object.keys(value1).concat(Object.keys(value2)));

  return allKeys.reduce((acc: AnyLiteral, key) => {
    const oldValue = value1[key];

    if (!value2.hasOwnProperty(key)) {
      acc[key] = oldValue;
    } else {
      const newValue = value2[key];
      // eslint-disable-next-line no-underscore-dangle
      if (!newValue?.__delete) {
        acc[key] = deepMerge(oldValue, newValue);
      }
    }

    return acc;
  }, {}) as T;
}

function reduceDiff(diff: AnyLiteral) {
  // eslint-disable-next-line no-underscore-dangle
  if (diff.__deleteAllChildren) {
    return {};
  }

  return Object.entries(diff).reduce((acc: AnyLiteral, [key, value]) => {
    // eslint-disable-next-line no-underscore-dangle
    if (!value?.__delete) {
      // eslint-disable-next-line no-null/no-null
      acc[key] = isLiteralObject(value) ? reduceDiff(value) : value;
    }

    return acc;
  }, {});
}
