import { ApiMediaFormat, ApiMessage } from '../../../../api/types';

import * as mediaLoader from '../../../../util/mediaLoader';
import {
  getMessageContact,
  getMessageMediaHash,
  getMessagePhoto,
  getMessageText,
  getMessageTextWithSpoilers,
  getMessageWebPagePhoto,
  getMessageWebPageVideo,
  hasMessageLocalBlobUrl,
} from '../../../../global/helpers';
import { CLIPBOARD_ITEM_SUPPORTED, copyImageToClipboard, copyTextToClipboard } from '../../../../util/clipboard';
import getMessageIdsForSelectedText from '../../../../util/getMessageIdsForSelectedText';

type ICopyOptions = {
  label: string;
  icon: string;
  handler: () => void;
}[];

export function getMessageCopyOptions(
  message: ApiMessage,
  afterEffect?: () => void,
  onCopyLink?: () => void,
  onCopyMessages?: (messageIds: number[]) => void,
  onCopyNumber?: () => void,
): ICopyOptions {
  const options: ICopyOptions = [];
  const text = getMessageText(message);
  const photo = getMessagePhoto(message)
    || (!getMessageWebPageVideo(message) ? getMessageWebPagePhoto(message) : undefined);
  const contact = getMessageContact(message);
  const mediaHash = getMessageMediaHash(message, 'inline');
  const canImageBeCopied = photo && (mediaHash || hasMessageLocalBlobUrl(message)) && CLIPBOARD_ITEM_SUPPORTED;
  const selection = window.getSelection();

  if (canImageBeCopied) {
    options.push({
      label: 'lng_context_copy_image',
      icon: 'copy-media',
      handler: () => {
        Promise.resolve(mediaHash ? mediaLoader.fetch(mediaHash, ApiMediaFormat.BlobUrl) : photo!.blobUrl)
          .then(copyImageToClipboard);

        afterEffect?.();
      },
    });
  }

  if (text) {
    // Detect if the user has selection in the current message
    const hasSelection = Boolean((
      selection?.anchorNode?.parentNode
      && (selection.anchorNode.parentNode as HTMLElement).closest('.Message .content-inner')
      && selection.toString().replace(/(?:\r\n|\r|\n)/g, '') !== ''
    ));

    options.push({
      label: getCopyLabel(hasSelection),
      icon: 'copy',
      handler: () => {
        const messageIds = getMessageIdsForSelectedText();
        if (messageIds?.length && onCopyMessages) {
          onCopyMessages(messageIds);
        } else {
          const clipboardText = hasSelection && selection ? selection.toString() : getMessageTextWithSpoilers(message)!;
          copyTextToClipboard(clipboardText);
        }

        afterEffect?.();
      },
    });
  }

  if (onCopyLink) {
    options.push({
      label: 'lng_context_copy_message_link',
      icon: 'link',
      handler: () => {
        onCopyLink();

        afterEffect?.();
      },
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

function getCopyLabel(hasSelection: boolean): string {
  if (hasSelection) {
    return 'lng_context_copy_selected';
  }
  return 'lng_context_copy_text';
}
