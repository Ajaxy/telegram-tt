import { SVG_NAMESPACE } from '../config';
import { requestMutation } from '../lib/fasterdom/fasterdom';
import jsxToHtml from './element/jsxToHtml';
import generateUniqueId from './generateUniqueId';

const DEFINITION_MAP = new Map<string, Element>();

let defs: SVGElement | undefined;

function init() {
  if (defs) return;

  const container = document.createElementNS(SVG_NAMESPACE, 'svg');
  container.setAttribute('width', '0');
  container.setAttribute('height', '0');
  container.setAttribute('viewBox', '0 0 1 1');
  container.classList.add('svg-definitions');
  document.body.appendChild(container);

  defs = document.createElementNS(SVG_NAMESPACE, 'defs');
  container.appendChild(defs);
}

function appendElement(element: Element) {
  requestMutation(() => {
    if (!defs) init();
    defs!.appendChild(element);
  });
}

export function addSvgDefinition(element: React.JSX.Element, id?: string) {
  id ??= generateUniqueId();
  element.props.id = id;

  const htmlElement = jsxToHtml(element)[0];
  DEFINITION_MAP.set(element.props.id, htmlElement);
  appendElement(htmlElement);
  return id;
}

export function removeSvgDefinition(id: string) {
  const element = DEFINITION_MAP.get(id);
  if (element) {
    element.remove();
    DEFINITION_MAP.delete(id);
  }
}
