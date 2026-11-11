import { SVG_NAMESPACE } from '../config';
import { requestMutation } from '../lib/fasterdom/fasterdom';
import jsxToHtml from './element/jsxToHtml';
import generateUniqueId from './generateUniqueId';

const DEFINITION_MAP = new WeakMap<Document, Map<string, Element>>();
const DEFS_BY_DOCUMENT = new WeakMap<Document, SVGElement>();

function init(targetDocument: Document) {
  const existingDefs = DEFS_BY_DOCUMENT.get(targetDocument);
  if (existingDefs) return existingDefs;

  const container = targetDocument.createElementNS(SVG_NAMESPACE, 'svg');
  container.setAttribute('width', '0');
  container.setAttribute('height', '0');
  container.setAttribute('viewBox', '0 0 1 1');
  container.classList.add('svg-definitions');
  targetDocument.body.appendChild(container);

  const defs = targetDocument.createElementNS(SVG_NAMESPACE, 'defs');
  container.appendChild(defs);
  DEFS_BY_DOCUMENT.set(targetDocument, defs);
  return defs;
}

function appendElement(element: Element, targetDocument: Document) {
  requestMutation(() => {
    init(targetDocument).appendChild(element);
  });
}

export function addSvgDefinition(element: React.JSX.Element, id?: string, targetDocument = document) {
  id ??= generateUniqueId();
  element.props.id = id;

  const htmlElement = jsxToHtml(element)[0];
  const definitions = DEFINITION_MAP.get(targetDocument) || new Map<string, Element>();
  DEFINITION_MAP.set(targetDocument, definitions);
  definitions.set(element.props.id, htmlElement);
  appendElement(htmlElement, targetDocument);
  return id;
}

export function removeSvgDefinition(id: string, targetDocument = document) {
  const definitions = DEFINITION_MAP.get(targetDocument);
  const element = definitions?.get(id);
  if (element) {
    requestMutation(() => {
      element.remove();
    });
    definitions!.delete(id);
  }
}
