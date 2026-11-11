import type { ApiMessage, StatefulMediaContent } from '../../../../api/types';
import type { MessageListType, ThreadId } from '../../../../types';
import type { IconName } from '../../../../types/icons';
import type { RegularLangKey } from '../../../../types/language';
import type { ClipboardTextFormat, MessageCopyRequest } from '../../../../types/messageCopy';
import { ApiMediaFormat } from '../../../../api/types';

import {
  getMessageContact,
  getMessagePhoto,
  getMessageText,
  getPhotoMediaHash,
  getWebPagePhoto,
  getWebPageVideo,
  hasMediaLocalBlobUrl,
} from '../../../../global/helpers';
import { IS_SAFARI } from '../../../../util/browser/windowEnvironment';
import {
  CLIPBOARD_ITEM_SUPPORTED,
  copyImageToClipboard,
  copyTextToClipboard,
} from '../../../../util/clipboard';
import * as mediaLoader from '../../../../util/mediaLoader';
import { captureMessageCopyRequest } from './getSelectionAsFormattedText';

type ICopyOptions = {
  label: RegularLangKey;
  icon: IconName;
  canCopyWithFormat?: boolean;
  handler: (textFormat?: ClipboardTextFormat) => void;
}[];

export function getMessageCopyOptions(
  message: ApiMessage,
  statefulContent: StatefulMediaContent | undefined,
  threadId: ThreadId,
  messageListType: MessageListType,
  href?: string,
  canCopy?: boolean,
  afterEffect?: () => void,
  onCopyLink?: () => void,
  onCopyMessages?: (request: MessageCopyRequest, textFormat?: ClipboardTextFormat) => void,
  onCopyNumber?: () => void,
): ICopyOptions {
  const { webPage } = statefulContent || {};
  const options: ICopyOptions = [];
  const text = getMessageText(message);
  const photo = getMessagePhoto(message)
    || (!getWebPageVideo(webPage) ? getWebPagePhoto(webPage) : undefined);
  const contact = getMessageContact(message);
  const mediaHash = photo ? getPhotoMediaHash(photo, 'full') : undefined;
  const canImageBeCopied = canCopy && photo && (mediaHash || hasMediaLocalBlobUrl(photo))
    && CLIPBOARD_ITEM_SUPPORTED && !IS_SAFARI;
  const selection = window.getSelection();

  if (canImageBeCopied) {
    options.push({
      label: 'ContextCopyImage',
      icon: 'copy-media',
      handler: () => {
        Promise.resolve(mediaHash ? mediaLoader.fetch(mediaHash, ApiMediaFormat.BlobUrl) : photo.blobUrl)
          .then(copyImageToClipboard);

        afterEffect?.();
      },
    });
  }

  if (canCopy && href) {
    options.push({
      label: 'CopyLink',
      icon: 'copy',
      handler: () => {
        copyTextToClipboard(href);

        afterEffect?.();
      },
    });
  } else if (canCopy && message.content.widget && getWidgetSelectedText(message)) {
    options.push({
      label: 'ContextCopySelected',
      icon: 'copy',
      handler: () => {
        copyTextToClipboard(getWidgetSelectedText(message)!);
        afterEffect?.();
      },
    });
  } else if (canCopy && (text || message.content.richMessage)) {
    // Detect if the user has selection in the current message
    const hasSelection = Boolean((
      selection?.anchorNode?.parentNode
      && (selection.anchorNode.parentNode as HTMLElement).closest('.Message .content-inner')
      && selection.toString().replace(/(?:\r\n|\r|\n)/g, '') !== ''
      && checkMessageHasSelection(message)
    ));

    options.push({
      label: getCopyLabel(hasSelection),
      icon: 'copy',
      canCopyWithFormat: !hasSelection,
      handler: (textFormat) => {
        if (!onCopyMessages) return;

        const selectionRequest = hasSelection
          ? captureMessageCopyRequest(message.chatId, threadId, messageListType)
          : undefined;
        if (selectionRequest && (
          selectionRequest.type === 'messages' || selectionRequest.messageId === message.id
        )) {
          onCopyMessages(selectionRequest, textFormat);
          return;
        }

        onCopyMessages({
          type: 'messages',
          chatId: message.chatId,
          threadId,
          messageListType,
          messageIds: [message.id],
        }, textFormat);
      },
    });
  }

  if (onCopyLink) {
    options.push({
      label: 'ContextCopyMessageLink',
      icon: 'link',
      handler: onCopyLink,
    });
  }

  if (contact && onCopyNumber) {
    options.push({
      label: 'ProfileCopyPhone',
      icon: 'copy',
      handler: () => {
        onCopyNumber();

        afterEffect?.();
      },
    });
  }

  return options;
}
// A widget's text sits in its shadow root: Chromium and WebKit report the document's selection collapsed at the root's
// host, and its composed ranges find the text; Firefox's range is in the root itself
function getWidgetSelectedText(message: ApiMessage) {
  const selection = window.getSelection();
  const text = selection?.rangeCount ? selection.toString() : '';
  if (!selection || !text.trim()) return undefined;

  const messageElement = document.querySelector(`.Message.message-list-item[data-message-id="${message.id}"]`);
  for (const host of messageElement?.querySelectorAll('.widget-shadow') || []) {
    const root = host.shadowRoot;
    if (!root) continue;
    let range: AbstractRange | undefined;
    try {
      range = 'getComposedRanges' in selection ? selection.getComposedRanges({ shadowRoots: [root] })[0] : undefined;
    } catch {
      // An engine that takes the shadow roots as arguments
    }
    range ??= selection.getRangeAt(0);
    if (!range.collapsed && (root.contains(range.startContainer) || root.contains(range.endContainer))) return text;
  }

  return undefined;
}

function checkMessageHasSelection(message: ApiMessage): boolean {
  const selection = window.getSelection();
  const selectionParentNode = selection?.anchorNode?.parentNode as HTMLElement;
  const selectedMessageElement = selectionParentNode?.closest<HTMLDivElement>('.Message.message-list-item');
  return String(message.id) === selectedMessageElement?.dataset.messageId;
}
function getCopyLabel(hasSelection: boolean): RegularLangKey {
  if (hasSelection) {
    return 'ContextCopySelected';
  }
  return 'ContextCopyText';
}
