import type { ApiInlineButtonAction, ApiRichButtonStyle } from '../../api/types';

import { MAX_BUTTONS_PER_ROW } from '../../global/helpers/buttons';

export const RICH_BUTTON_NODE_NAME = 'richButton';
export const BUTTON_ROW_NODE_NAME = 'buttonRow';
export const EMPTY_RICH_BUTTON = { type: RICH_BUTTON_NODE_NAME, attrs: { buttonType: 'disabled' } };
export const EMPTY_BUTTON_ROW = { type: BUTTON_ROW_NODE_NAME, content: [EMPTY_RICH_BUTTON] };

export function buildButtonAction(attrs?: Record<string, unknown>): ApiInlineButtonAction | undefined {
  switch (attrs?.buttonType) {
    case 'url':
      return typeof attrs.url === 'string' && attrs.url ? { type: 'url', url: attrs.url } : undefined;
    case 'userProfile':
      return typeof attrs.userId === 'string' && /^\d+$/.test(attrs.userId)
        ? { type: 'userProfile', userId: attrs.userId } : undefined;
    case 'copy':
      return typeof attrs.copyText === 'string' && attrs.copyText
        ? { type: 'copy', copyText: attrs.copyText } : undefined;
    case 'disabled':
      return { type: 'disabled' };
    default:
      return undefined;
  }
}

export function buildButtonAttrs(action: ApiInlineButtonAction, style?: ApiRichButtonStyle) {
  return {
    buttonType: action.type,
    url: action.type === 'url' ? action.url : undefined,
    userId: action.type === 'userProfile' ? action.userId : undefined,
    copyText: action.type === 'copy' ? action.copyText : undefined,
    color: style?.type,
  };
}

export function getButtonColor(value: unknown): ApiRichButtonStyle['type'] {
  return value === 'primary' || value === 'destructive' || value === 'success' ? value : undefined;
}

export function getButtonRowAlign(value: unknown) {
  return value === 'left' || value === 'center' || value === 'right' ? value : undefined;
}

export function buildButtonHtmlAttrs(attrs: Record<string, unknown>) {
  const action = buildButtonAction(attrs);
  const color = getButtonColor(attrs.color);
  const result: Record<string, string> = {
    type: typeof attrs.buttonType === 'string' ? attrs.buttonType : 'disabled',
  };
  if (color) result.style = color === 'destructive' ? 'danger' : color;
  if (action?.type === 'url' || action?.type === 'userProfile') {
    result.type = 'url';
    result.url = action.type === 'url' ? action.url : `tg://user?id=${action.userId}`;
  } else if (action?.type === 'copy') {
    result.type = 'copy_text';
    result.text = action.copyText;
  }
  return result;
}

export function parseButtonHtmlAttrs(element: HTMLElement) {
  const type = element.getAttribute('type');
  const url = element.getAttribute('url');
  const userId = type === 'url' && url?.match(/^tg:\/\/user\?id=(\d+)$/)?.[1];
  const color = element.getAttribute('style');
  const attrs = {
    buttonType: userId ? 'userProfile' : type === 'copy_text' ? 'copy' : type,
    url,
    userId,
    copyText: element.getAttribute('text'),
    color: getButtonColor(color === 'danger' ? 'destructive' : color),
  };
  return buildButtonAction(attrs) ? attrs : false;
}

export function normalizeButtonHtml(root: DocumentFragment) {
  root.querySelectorAll<HTMLElement>('tg-button').forEach((element) => {
    if (!parseButtonHtmlAttrs(element)) {
      element.remove();
      return;
    }
    element.querySelectorAll<HTMLElement>('*').forEach((child) => {
      if (child.tagName === 'TG-EMOJI' || child.tagName === 'TG-TIME') return;
      if (child.tagName === 'TG-BUTTON') {
        child.replaceWith(child.textContent || '');
        return;
      }
      child.replaceWith(...child.childNodes);
    });
  });
  root.querySelectorAll<HTMLElement>('tg-button-row').forEach((row) => {
    const buttons = Array.from(row.children).filter((child) => child.tagName === 'TG-BUTTON');
    if (!buttons.length) {
      row.remove();
      return;
    }
    row.replaceChildren(...buttons.slice(0, MAX_BUTTONS_PER_ROW));
    let previousRow = row;
    for (let index = MAX_BUTTONS_PER_ROW; index < buttons.length; index += MAX_BUTTONS_PER_ROW) {
      const nextRow = row.cloneNode() as HTMLElement;
      nextRow.append(...buttons.slice(index, index + MAX_BUTTONS_PER_ROW));
      previousRow.after(nextRow);
      previousRow = nextRow;
    }
  });
}
