type CollectionByKey<Member> = Record<number | string, Member>;

type OrderDirection =
  'asc'
  | 'desc';

type OrderCallback<T> = (member: T) => unknown;

export function buildCollectionByKey<T extends AnyLiteral>(collection: T[], key: keyof T) {
  return collection.reduce((byKey: CollectionByKey<T>, member: T) => {
    byKey[member[key]] = member;

    return byKey;
  }, {});
}

export function buildCollectionByCallback<T extends AnyLiteral, K extends number | string, R>(
  collection: T[],
  callback: (member: T) => [K, R],
) {
  return collection.reduce((byKey: Record<K, R>, member: T) => {
    const [key, value] = callback(member);
    byKey[key] = value;

    return byKey;
  }, {} as Record<K, R>);
}

export function mapValues<R, M>(
  byKey: CollectionByKey<M>,
  callback: (member: M, key: string, index: number, originalByKey: CollectionByKey<M>) => R,
): CollectionByKey<R> {
  return Object.keys(byKey).reduce((newByKey: CollectionByKey<R>, key, index) => {
    newByKey[key] = callback(byKey[key], key, index, byKey);
    return newByKey;
  }, {});
}

export function pick<T, K extends keyof T>(object: T, keys: K[]) {
  return keys.reduce((result, key) => {
    result[key] = object[key];
    return result;
  }, {} as Pick<T, K>);
}

export function pickTruthy<T, K extends keyof T>(object: T, keys: K[]) {
  return keys.reduce((result, key) => {
    if (object[key]) {
      result[key] = object[key];
    }

    return result;
  }, {} as Pick<T, K>);
}

export function omit<T extends object, K extends keyof T>(object: T, keys: K[]): Omit<T, K> {
  const stringKeys = new Set(keys.map(String));
  const savedKeys = Object.keys(object)
    .filter((key) => !stringKeys.has(key)) as Array<Exclude<keyof T, K>>;

  return pick(object, savedKeys);
}

export function omitUndefined<T extends object>(object: T): T {
  return Object.keys(object).reduce((result, stringKey) => {
    const key = stringKey as keyof T;
    if (object[key] !== undefined) {
      result[key] = object[key];
    }
    return result;
  }, {} as T);
}

export function orderBy<T>(
  collection: T[],
  orderRule: (keyof T) | OrderCallback<T> | ((keyof T) | OrderCallback<T>)[],
  mode: OrderDirection | [OrderDirection, OrderDirection] = 'asc',
): T[] {
  function compareValues(a: T, b: T, currentOrderRule: (keyof T) | OrderCallback<T>, isAsc: boolean) {
    const aValue = (typeof currentOrderRule === 'function' ? currentOrderRule(a) : a[currentOrderRule]) || 0;
    const bValue = (typeof currentOrderRule === 'function' ? currentOrderRule(b) : b[currentOrderRule]) || 0;

    // @ts-expect-error Rely on the JS to handle the comparison
    return isAsc ? aValue - bValue : bValue - aValue;
  }

  if (Array.isArray(orderRule)) {
    const [mode1, mode2] = Array.isArray(mode) ? mode : [mode, mode];
    const [orderRule1, orderRule2] = orderRule;
    const isAsc1 = mode1 === 'asc';
    const isAsc2 = mode2 === 'asc';

    return collection.sort((a, b) => {
      return compareValues(a, b, orderRule1, isAsc1) || compareValues(a, b, orderRule2, isAsc2);
    });
  }

  const isAsc = mode === 'asc';
  return collection.sort((a, b) => {
    return compareValues(a, b, orderRule, isAsc);
  });
}

export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

export function uniqueByField<T>(array: T[], field: keyof T): T[] {
  return [...new Map(array.map((item) => [item[field], item])).values()];
}

export function compact<T>(array: T[]) {
  return array.filter(Boolean);
}

export function areSortedArraysEqual(array1: any[], array2: any[]) {
  if (array1.length !== array2.length) {
    return false;
  }

  return array1.every((item, i) => item === array2[i]);
}

export function areSortedArraysIntersecting(array1: any[], array2: any[]) {
  return array1[0] <= array2[array2.length - 1] && array1[array1.length - 1] >= array2[0];
}
export function isInsideSortedArrayRange(value: any, array: any[]) {
  return array[0] <= value && value <= array[array.length - 1];
}

export function findIntersectionWithSet<T>(array: T[], set: Set<T>): T[] {
  return array.filter((a) => set.has(a));
}
/**
 * Exlude elements from base array. Both arrays should be sorted in same order
 * @param base
 * @param toExclude
 * @returns New array without excluded elements
 */
export function excludeSortedArray<T>(base: T[], toExclude: T[]) {
  if (!base?.length) return base;

  const result: T[] = [];

  let excludeIndex = 0;

  for (let i = 0; i < base.length; i++) {
    if (toExclude[excludeIndex] === base[i]) {
      excludeIndex += 1;
    } else {
      result.push(base[i]);
    }
  }

  return result;
}

export function split<T>(array: T[], chunkSize: number) {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    result.push(array.slice(i, i + chunkSize));
  }

  return result;
}

export function partition<T>(
  array: T[], filter: (value: T, index: number, array: T[]) => boolean | undefined,
): [T[], T[]] {
  const pass: T[] = [];
  const fail: T[] = [];

  array.forEach((e, idx, arr) => (filter(e, idx, arr) ? pass : fail).push(e));

  return [pass, fail];
}

export function cloneDeep<T>(value: T): T {
  if (!isObject(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(cloneDeep) as typeof value;
  }

  return Object.keys(value).reduce((acc, key) => {
    acc[key as keyof T] = cloneDeep(value[key as keyof T]);
    return acc;
  }, {} as T);
}

export function isLiteralObject(value: any): value is AnyLiteral {
  return isObject(value) && !Array.isArray(value);
}

function isObject(value: any): value is object {
  // eslint-disable-next-line no-null/no-null
  return typeof value === 'object' && value !== null;
}

export function findLast<T>(array: Array<T>, predicate: (value: T, index: number, obj: T[]) => boolean): T | undefined {
  let cursor = array.length;

  while (cursor--) {
    if (predicate(array[cursor], cursor, array)) {
      return array[cursor];
    }
  }

  return undefined;
}

export function compareFields<T>(a: T, b: T) {
  return Number(b) - Number(a);
}
