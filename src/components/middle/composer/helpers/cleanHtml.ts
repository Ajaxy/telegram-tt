import { ApiMessageEntityTypes } from '../../../../api/types';

export const ENTITY_CLASS_BY_NODE_NAME: Record<string, ApiMessageEntityTypes> = {
  B: ApiMessageEntityTypes.Bold,
  STRONG: ApiMessageEntityTypes.Bold,
  I: ApiMessageEntityTypes.Italic,
  EM: ApiMessageEntityTypes.Italic,
  U: ApiMessageEntityTypes.Underline,
  INS: ApiMessageEntityTypes.Underline,
  S: ApiMessageEntityTypes.Strike,
  STRIKE: ApiMessageEntityTypes.Strike,
  DEL: ApiMessageEntityTypes.Strike,
  CODE: ApiMessageEntityTypes.Code,
  PRE: ApiMessageEntityTypes.Pre,
  BLOCKQUOTE: ApiMessageEntityTypes.Blockquote,
};

const parser = new DOMParser();

export function parseHtmlBody(html: string): HTMLElement {
  const parsedDocument = parser.parseFromString(html, 'text/html');

  return parsedDocument.body;
}

export function escapeHtml(html: string) {
  const fragment = document.createElement('div');
  const text = document.createTextNode(html);
  fragment.append(text);
  return fragment.innerHTML;
}

export function escapeHtmlAttribute(html: string) {
  return escapeHtml(html)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
