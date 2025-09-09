import type { ApiMessage, StatefulMediaContent } from '../../../../api/types';
import type { IconName } from '../../../../types/icons';
import { ApiMediaFormat } from '../../../../api/types';

import {
  getMessageContact,
  getMessageHtmlId,
  getMessagePhoto,
  getMessageText,
  getPhotoMediaHash,
  getWebPagePhoto,
  getWebPageVideo,
  hasMediaLocalBlobUrl,
} from '../../../../global/helpers';
import { getMessageTextWithSpoilers } from '../../../../global/helpers/messageSummary';
import { IS_SAFARI } from '../../../../util/browser/windowEnvironment';
import {
  CLIPBOARD_ITEM_SUPPORTED,
  copyHtmlToClipboard,
  copyImageToClipboard,
  copyTextToClipboard,
} from '../../../../util/clipboard';
import getMessageIdsForSelectedText from '../../../../util/getMessageIdsForSelectedText';
import { getTranslationFn } from '../../../../util/localization';
import * as mediaLoader from '../../../../util/mediaLoader';
import { renderMessageText } from '../../../common/helpers/renderMessageText';

type ICopyOptions = {
  label: string;
  icon: IconName;
  handler: () => void;
}[];

export function getMessageCopyOptions(
  message: ApiMessage,
  statefulContent: StatefulMediaContent | undefined,
  href?: string,
  canCopy?: boolean,
  afterEffect?: () => void,
  onCopyLink?: () => void,
  onCopyMessages?: (messageIds: number[]) => void,
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
      label: 'lng_context_copy_image',
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
      label: 'lng_context_copy_link',
      icon: 'copy',
      handler: () => {
        copyTextToClipboard(href);

        afterEffect?.();
      },
    });
  } else if (canCopy && text) {
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
      handler: () => {
        const messageIds = getMessageIdsForSelectedText();
        if (messageIds?.length && onCopyMessages) {
          onCopyMessages(messageIds);
        } else if (hasSelection) {
          document.execCommand('copy');
        } else {
          const clipboardText = renderMessageText(
            { message, shouldRenderAsHtml: true },
          ) as string[];
          if (clipboardText) {
            copyHtmlToClipboard(
              clipboardText.join(''),
              getMessageTextWithSpoilers(getTranslationFn(), message, statefulContent)!,
            );
          }
        }

        afterEffect?.();
      },
    });
  }

  if (onCopyLink) {
    options.push({
      label: 'lng_context_copy_message_link',
      icon: 'link',
      handler: onCopyLink,
    });
  }

  if (contact && onCopyNumber) {
    options.push({
      label: 'lng_profile_copy_phone',
      icon: 'copy',
      handler: () => {
        onCopyNumber();

        afterEffect?.();
      },
    });
  }

  return options;
}
function checkMessageHasSelection(message: ApiMessage): boolean {
  const selection = window.getSelection();
  const selectionParentNode = selection?.anchorNode?.parentNode as HTMLElement;
  const selectedMessageElement = selectionParentNode?.closest<HTMLDivElement>('.Message.message-list-item');
  return getMessageHtmlId(message.id) === selectedMessageElement?.id;
}
function getCopyLabel(hasSelection: boolean): string {
  if (hasSelection) {
    return 'lng_context_copy_selected';
  }
  return 'lng_context_copy_text';
}
