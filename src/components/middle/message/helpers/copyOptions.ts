import { ApiMediaFormat, ApiMessage } from '../../../../api/types';

import * as mediaLoader from '../../../../util/mediaLoader';
import { getMessageMediaHash, getMessagePhoto, getMessageText } from '../../../../modules/helpers';
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
  const photo = getMessagePhoto(message);
  const mediaHash = getMessageMediaHash(message, 'inline')!;
  const canImageBeCopied = photo && mediaHash && CLIPBOARD_ITEM_SUPPORTED;
  const selection = window.getSelection();

  if (canImageBeCopied) {
    options.push({
      label: 'Copy Media',
      handler: () => {
        mediaLoader.fetch(mediaHash, ApiMediaFormat.BlobUrl).then(copyImageToClipboard);

        if (afterEffect) {
          afterEffect();
        }
      },
    });
  }

  if (text) {
    // Detect if the user has selection in the current message
    const hasSelection = Boolean((
      selection
      && selection.anchorNode
      && selection.anchorNode.parentNode
      && (selection.anchorNode.parentNode as HTMLElement).closest('.Message .content-inner')
      && selection.toString().replace(/(?:\r\n|\r|\n)/g, '') !== ''
    ));

    options.push({
      label: getCopyLabel(hasSelection, canImageBeCopied),
      handler: () => {
        const clipboardText = hasSelection && selection ? selection.toString() : text;
        copyTextToClipboard(clipboardText);

        if (afterEffect) {
          afterEffect();
        }
      },
    });
  }

  if (onCopyLink) {
    options.push({
      label: 'CopyMessageLink',
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

function getCopyLabel(hasSelection: boolean, canImageBeCopied: boolean): string {
  if (hasSelection) {
    return 'Copy Selected Text';
  }

  if (canImageBeCopied) {
    return 'Copy Text';
  }

  return 'Copy';
}
