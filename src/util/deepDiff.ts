const EQUAL = Symbol('EQUAL');

function deepAreSortedArraysEqual<T extends Array<any>>(array1: T, array2: T) {
  if (array1.length !== array2.length) {
    return false;
  }

  return array1.every((item, i) => deepDiff(item, array2[i]) === EQUAL);
}

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
    if (deepAreSortedArraysEqual(value1, value2)) return EQUAL;

    return value2;
  }

  const object1 = value1 as AnyLiteral;
  const object2 = value2 as AnyLiteral;
  const keys1 = Array.from(new Set([...Object.keys(object1), ...Object.keys(object2)]));

  const reduced = keys1.reduce((acc: any, el) => {
    if (object1[el] === object2[el]) {
      return acc;
    }

    const o1has = object1.hasOwnProperty(el);
    const o2has = object2.hasOwnProperty(el);
    if (!o2has) {
      acc[el] = { __delete: true };
      return acc;
    }
    if (!o1has && o2has) {
      acc[el] = object2[el];
      return acc;
    }

    const diff = deepDiff(object1[el], object2[el]);
    if (diff !== EQUAL) acc[el] = diff;
    return acc;
  }, {});

  if (Object.keys(reduced).length === 0) {
    return EQUAL;
  }

  return reduced;
}
