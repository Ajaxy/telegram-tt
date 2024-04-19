import { unique } from './iteratees';

const EQUAL = Symbol('EQUAL');

export function deepDiff<T extends any>(value1: T, value2: T): Partial<T> | typeof EQUAL {
  const type1 = typeof value1;
  const type2 = typeof value2;

  if (value1 === value2) {
    return EQUAL;
  }

  if (type1 !== type2) {
    return value2;
  }

  if (type2 !== 'object') {
    return value2;
  }

  if (Array.isArray(value1) && Array.isArray(value2)) {
    if (areSortedArraysDeepEqual(value1, value2)) return EQUAL;

    return value2;
  }

  const object1 = value1 as AnyLiteral;
  const object2 = value2 as AnyLiteral;
  const allKeys = unique(Object.keys(object1).concat(Object.keys(object2)));

  const diff = allKeys.reduce((acc: any, key) => {
    if (object1[key] === object2[key]) {
      return acc;
    }

    const o1has = object1.hasOwnProperty(key);
    const o2has = object2.hasOwnProperty(key);
    if (!o2has) {
      acc[key] = { __delete: true };
      return acc;
    }
    if (!o1has && o2has) {
      acc[key] = object2[key];
      return acc;
    }

    const subDiff = deepDiff(object1[key], object2[key]);
    if (subDiff !== EQUAL) {
      acc[key] = subDiff;
    }

    return acc;
  }, {});

  if (Object.keys(diff).length === 0) {
    return EQUAL;
  }

  return diff;
}

function areSortedArraysDeepEqual<T extends Array<any>>(array1: T, array2: T) {
  if (array1.length !== array2.length) {
    return false;
  }

  return array1.every((item, i) => deepDiff(item, array2[i]) === EQUAL);
}
