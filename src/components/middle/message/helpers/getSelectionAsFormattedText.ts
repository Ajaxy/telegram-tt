import type { ApiFormattedText } from '../../../../api/types';
import { ApiMessageEntityTypes } from '../../../../api/types';

import parseHtmlAsFormattedText from '../../../../util/parseHtmlAsFormattedText';

const div = document.createElement('div');
const ALLOWED_QUOTE_ENTITIES = new Set([
  ApiMessageEntityTypes.Bold,
  ApiMessageEntityTypes.Italic,
  ApiMessageEntityTypes.Underline,
  ApiMessageEntityTypes.Strike,
  ApiMessageEntityTypes.Spoiler,
  ApiMessageEntityTypes.CustomEmoji,
]);

export function getSelectionAsFormattedText(range: Range) {
  const html = getSelectionAsHtml(range);
  const formattedText = parseHtmlAsFormattedText(html, false, true);

  return stripEntitiesForQuote(formattedText);
}

function getSelectionAsHtml(range: Range) {
  const clonedSelection = range.cloneContents();
  div.appendChild(clonedSelection);

  const html = wrapHtmlWithMarkupTags(range, div.innerHTML);
  div.innerHTML = '';

  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/gi, ' ') // Convert nbsp's to spaces
    .replace(/\u00a0/gi, ' ');
}

function stripEntitiesForQuote(text: ApiFormattedText): ApiFormattedText {
  if (!text.entities) return text;

  const entities = text.entities.filter((entity) => ALLOWED_QUOTE_ENTITIES.has(entity.type as ApiMessageEntityTypes));
  return { ...text, entities: entities.length ? entities : undefined };
}

function wrapHtmlWithMarkupTags(range: Range, html: string) {
  const container = range.commonAncestorContainer;
  if (container.nodeType === Node.ELEMENT_NODE && (container as Element).classList.contains('text-content')) {
    return html;
  }
  let currentElement = range.commonAncestorContainer.parentElement;
  while (currentElement && !currentElement.classList.contains('text-content')) {
    const tag = currentElement.tagName.toLowerCase();
    const entityType = currentElement.dataset.entityType;
    html = `<${tag} ${entityType ? `data-entity-type="${entityType}"` : ''}>${html}</${tag}>`;
    currentElement = currentElement.parentElement;
  }

  return html;
}
