let counter = 0;

export function disableDirectTextInput() {
  counter += 1;
}

export function enableDirectTextInput() {
  counter -= 1;
}

export function getIsDirectTextInputDisabled() {
  return counter > 0;
}
