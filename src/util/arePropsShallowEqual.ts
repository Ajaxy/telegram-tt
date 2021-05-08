export default function arePropsShallowEqual(currentProps: AnyLiteral, newProps: AnyLiteral) {
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

export function getUnequalProps(currentProps: AnyLiteral, newProps: AnyLiteral) {
  const currentKeys = Object.keys(currentProps);
  const currentKeysLength = currentKeys.length;
  const newKeysLength = Object.keys(newProps).length;

  if (currentKeysLength !== newKeysLength) {
    return ['%LENGTH%'];
  }

  return currentKeys.filter((prop) => currentProps[prop] !== newProps[prop]);
}
