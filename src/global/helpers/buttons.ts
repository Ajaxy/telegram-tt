import type {
  ApiInlineButtonAction,
  ApiInputRichMessage,
  ApiKeyboardButton,
  ApiRichButton,
  ApiRichText,
} from '../../api/types';

import { forEachPageBlocksRichText, forEachRichTextNode } from '../../util/text/richText';

export const MAX_BUTTONS_PER_ROW = 8;

export function isButtonUnsupported(action: ApiKeyboardButton['action']) {
  return action.type === 'unsupported' || action.type === 'disabled'
    || (action.type === 'callback' && action.requiresPassword)
    || (action.type === 'switchBotInline' && Boolean(action.peerTypes?.length));
}

export function canAuthorButton(action: ApiInlineButtonAction) {
  return action.type === 'url' || action.type === 'userProfile' || action.type === 'copy' || action.type === 'disabled';
}

export function normalizeButtonText(text: ApiRichText): ApiRichText {
  switch (text.type) {
    case 'plain':
    case 'empty':
    case 'customEmoji':
      return text;
    case 'date':
      return { ...text, text: normalizeButtonText(text.text) };
    case 'concat':
      return { type: 'concat', texts: text.texts.map(normalizeButtonText) };
    case 'image':
      return { type: 'empty' };
    case 'math':
      return { type: 'plain', text: text.source };
    default:
      return normalizeButtonText(text.text);
  }
}

export function getRichMessageButtons(richMessage: ApiInputRichMessage) {
  const buttons: ApiRichButton[] = [];
  forEachPageBlocksRichText(richMessage.blocks, (text) => forEachRichTextNode(text, (node) => {
    if (node.type === 'button') buttons.push(node);
  }), (block) => {
    if (block.type !== 'buttonRow') return true;

    buttons.push(...block.buttons);
    return false;
  });

  return buttons;
}
