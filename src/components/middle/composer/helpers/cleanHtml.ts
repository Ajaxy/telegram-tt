import { ApiMessageEntityTypes } from '../../../../api/types';

import { DEBUG } from '../../../../config';
import cleanDocsHtml from '../../../../lib/cleanDocsHtml';
import { ENTITY_CLASS_BY_NODE_NAME } from '../../../../util/parseHtmlAsFormattedText';

const STYLE_TAG_REGEX = /<style>(.*?)<\/style>/gs;

export function preparePastedHtml(html: string) {
  let fragment = document.createElement('div');
  try {
    html = cleanDocsHtml(html);
  } catch (err) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  }
  fragment.innerHTML = html.replace(/\u00a0/g, ' ').replace(STYLE_TAG_REGEX, ''); // Strip &nbsp and styles

  const textContents = fragment.querySelectorAll<HTMLDivElement>('.text-content');
  if (textContents.length) {
    fragment = textContents[textContents.length - 1]; // Replace with the last copied message
  }

  Array.from(fragment.getElementsByTagName('*')).forEach((node) => {
    if (!(node instanceof HTMLElement)) {
      node.remove();
      return;
    }
    node.removeAttribute('style');

    // Fix newlines
    if (node.tagName === 'BR') node.replaceWith('\n');
    if (node.tagName === 'P') node.appendChild(document.createTextNode('\n'));
    if (node.tagName === 'IMG' && !node.dataset.entityType) node.replaceWith(node.getAttribute('alt') || '');
    // We do not intercept copy logic, so we remove some nodes here
    if (node.dataset.ignoreOnPaste) node.remove();

    if (ENTITY_CLASS_BY_NODE_NAME[node.tagName]) {
      node.setAttribute('data-entity-type', ENTITY_CLASS_BY_NODE_NAME[node.tagName]);
    }
    // Strip non-entity tags
    if (!node.dataset.entityType && node.textContent === node.innerText) node.replaceWith(node.textContent);
    // Append entity parameters for parsing
    if (node.dataset.alt) node.setAttribute('alt', node.dataset.alt);
    switch (node.dataset.entityType) {
      case ApiMessageEntityTypes.MentionName:
        node.replaceWith(node.textContent || '');
        break;
      case ApiMessageEntityTypes.CustomEmoji:
        node.textContent = node.dataset.alt || '';
        break;
    }
  });

  return fragment.innerHTML.trimEnd();
}

export function escapeHtml(html: string) {
  const fragment = document.createElement('div');
  const text = document.createTextNode(html);
  fragment.appendChild(text);
  return fragment.innerHTML;
}
