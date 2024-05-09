export function areDeepEqual<T extends any>(value1: T, value2: T): boolean {
  const type1 = typeof value1;
  const type2 = typeof value2;
  if (type1 !== type2) {
    return false;
  }

  // eslint-disable-next-line no-null/no-null
  if (type1 !== 'object' || value1 === null || value2 === null) {
    return value1 === value2;
  }

  const isArray1 = Array.isArray(value1);
  const isArray2 = Array.isArray(value2);

  if (isArray1 !== isArray2) {
    return false;
  }

  if (isArray1) {
    const array1 = value1 as any[];
    const array2 = value2 as any[];

    if (array1.length !== array2.length) {
      return false;
    }

    return array1.every((member1, i) => areDeepEqual(member1, array2[i]));
  }

  const object1 = value1 as AnyLiteral;
  const object2 = value2 as AnyLiteral;
  const keys1 = Object.keys(object1);

  return keys1.length === Object.keys(object2).length
    && keys1.every((key1) => areDeepEqual(object1[key1], object2[key1]));
}
