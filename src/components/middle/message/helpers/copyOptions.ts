import { ApiMediaFormat, ApiMessage } from '../../../../api/types';

import * as mediaLoader from '../../../../util/mediaLoader';
import {
  getMessageMediaHash,
  getMessagePhoto,
  getMessageText,
  getMessageTextWithSpoilers,
  getMessageWebPagePhoto,
  getMessageWebPageVideo,
  hasMessageLocalBlobUrl,
} from '../../../../modules/helpers';
import { CLIPBOARD_ITEM_SUPPORTED, copyImageToClipboard, copyTextToClipboard } from '../../../../util/clipboard';

type ICopyOptions = {
  label: string;
  handler: () => void;
}[];

export function getMessageCopyOptions(
  message: ApiMessage, afterEffect?: () => void, onCopyLink?: () => void,
): ICopyOptions {
  const options: ICopyOptions = [];
  const text = getMessageText(message);
  const photo = getMessagePhoto(message)
    || (!getMessageWebPageVideo(message) ? getMessageWebPagePhoto(message) : undefined);
  const mediaHash = getMessageMediaHash(message, 'inline');
  const canImageBeCopied = photo && (mediaHash || hasMessageLocalBlobUrl(message)) && CLIPBOARD_ITEM_SUPPORTED;
  const selection = window.getSelection();

  if (canImageBeCopied) {
    options.push({
      label: 'lng_context_copy_image',
      handler: () => {
        Promise.resolve(mediaHash ? mediaLoader.fetch(mediaHash, ApiMediaFormat.BlobUrl) : photo!.blobUrl)
          .then(copyImageToClipboard);

        if (afterEffect) {
          afterEffect();
        }
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
      handler: () => {
        const clipboardText = hasSelection && selection ? selection.toString() : getMessageTextWithSpoilers(message)!;
        copyTextToClipboard(clipboardText);

        if (afterEffect) {
          afterEffect();
        }
      },
    });
  }

  if (onCopyLink) {
    options.push({
      label: 'lng_context_copy_message_link',
      handler: () => {
        onCopyLink();

        if (afterEffect) {
          afterEffect();
        }
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
