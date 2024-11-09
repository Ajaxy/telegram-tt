import generateUniqueId from './generateUniqueId';

export const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

const CONTAINER = document.createElementNS(SVG_NAMESPACE, 'svg');
CONTAINER.setAttribute('width', '0');
CONTAINER.setAttribute('height', '0');
CONTAINER.setAttribute('viewBox', '0 0 1 1');
CONTAINER.classList.add('svg-definitions');
document.body.appendChild(CONTAINER);

const DEFS = document.createElementNS(SVG_NAMESPACE, 'defs');
CONTAINER.appendChild(DEFS);

const DEFINITION_MAP = new Map<string, SVGElement>();

export function addSvgDefinition(element: SVGElement, id?: string) {
  id ??= generateUniqueId();
  element.id = id;

  DEFS.appendChild(element);
  DEFINITION_MAP.set(element.id, element);
  return id;
}

export function removeSvgDefinition(id: string) {
  const element = DEFINITION_MAP.get(id);
  if (element) {
    element.remove();
    DEFINITION_MAP.delete(id);
  }
}
