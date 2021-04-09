export const createElement = (tagName = 'div') => {
  return document.createElement(tagName);
};

export function addEventListener(element, event, cb) {
  element.addEventListener(event, cb);
}

export function removeEventListener(element, event, cb) {
  element.removeEventListener(event, cb);
}
