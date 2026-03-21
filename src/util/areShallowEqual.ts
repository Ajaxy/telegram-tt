export function areRecordsShallowEqual(currentProps: AnyLiteral, newProps: AnyLiteral) {
  if (currentProps === newProps) {
    return true;
  }

  const currentKeys = Object.keys(currentProps);
  const currentKeysLength = currentKeys.length;
  const newKeysLength = Object.keys(newProps).length;

  if (currentKeysLength !== newKeysLength) {
    return false;
  }

  if (currentKeysLength === 0) {
    return true;
  }

  for (let i = 0; i < currentKeysLength; i++) {
    const prop = currentKeys[i];
    if (currentProps[prop] !== newProps[prop]) {
      return false;
    }
  }

  return true;
}

export function areArraysShallowEqual(currentProps: unknown[], newProps: unknown[]) {
  if (currentProps === newProps) {
    return true;
  }

  if (currentProps.length !== newProps.length) {
    return false;
  }

  return currentProps.every((item, i) => item === newProps[i]);
}

export default function areShallowEqual<T extends AnyLiteral | unknown[] | undefined>(oldValue: T, newValue: T) {
  if (oldValue === newValue) return true;
  if (oldValue === undefined || newValue === undefined) return false;
  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    return areArraysShallowEqual(oldValue, newValue);
  }
  return areRecordsShallowEqual(oldValue, newValue);
}

export function logUnequalProps(currentProps: AnyLiteral, newProps: AnyLiteral, msg: string, debugKey = '') {
  const currentKeys = Object.keys(currentProps);
  const currentKeysLength = currentKeys.length;
  const newKeysLength = Object.keys(newProps).length;

  if (currentKeysLength !== newKeysLength) {
    // eslint-disable-next-line no-console
    console.log(`${msg} LENGTH`);
    return;
  }

  // eslint-disable-next-line no-console
  console.log(msg);
  currentKeys.forEach((prop) => {
    if (currentProps[prop] !== newProps[prop]) {
      // eslint-disable-next-line no-console
      console.log(debugKey, prop, ':', currentProps[prop], '=>', newProps[prop]);
    }
  });
}
