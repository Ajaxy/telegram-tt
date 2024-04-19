import { unique } from './iteratees';

const EQUAL = Symbol('EQUAL');
const DELETE = { __delete: true };
const DELETE_ALL_CHILDREN = { __deleteAllChildren: true };

export function deepDiff<T extends any>(value1: T, value2: T): Partial<T> | typeof EQUAL | typeof DELETE_ALL_CHILDREN {
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
  const keys1 = Object.keys(object1);
  const keys2 = Object.keys(object2);

  if (!keys2.length) {
    return !keys1.length ? EQUAL : DELETE_ALL_CHILDREN;
  }

  const allKeys = unique(keys1.concat(keys2));

  const diff = allKeys.reduce((acc: any, key) => {
    if (object1[key] === object2[key]) {
      return acc;
    }

    const o1has = object1.hasOwnProperty(key);
    const o2has = object2.hasOwnProperty(key);
    if (!o2has) {
      acc[key] = DELETE;
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
