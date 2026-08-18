import type { ClipboardTextContent, ClipboardTextFormat } from '../types/messageCopy';

import { DEBUG } from '../config';

export const CLIPBOARD_ITEM_SUPPORTED = window.navigator.clipboard && window.ClipboardItem;

const textCopyEl = document.createElement('textarea');
textCopyEl.setAttribute('readonly', '');
textCopyEl.tabIndex = -1;
textCopyEl.className = 'visually-hidden';

export const copyTextToClipboard = (str: string): boolean => {
  textCopyEl.value = str;
  document.body.appendChild(textCopyEl);
  const selection = document.getSelection();
  let isCopied = false;

  if (selection) {
    // Store previous selection
    const rangeToRestore = selection.rangeCount > 0 && selection.getRangeAt(0);
    textCopyEl.select();
    isCopied = document.execCommand('copy');
    // Restore the original selection
    if (rangeToRestore) {
      selection.removeAllRanges();
      selection.addRange(rangeToRestore);
    }
  }

  document.body.removeChild(textCopyEl);
  return isCopied;
};

export const copyImageToClipboard = (imageUrl?: string) => {
  if (!imageUrl) return;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const imageEl = new Image();
  imageEl.onload = (e: Event) => {
    if (ctx && e.currentTarget) {
      const img = e.currentTarget as HTMLImageElement;
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0, img.width, img.height);
      canvas.toBlob(copyBlobToClipboard, 'image/png', 1);
    }
  };

  imageEl.src = imageUrl;
};

export async function copyTextToClipboardFromPromise(
  getContentPromise: Promise<string | ClipboardTextContent | undefined>,
  onSuccess?: NoneToVoidFunction,
  onFailure?: NoneToVoidFunction,
  textFormat?: ClipboardTextFormat,
) {
  const contentPromise = getContentPromise.then((content) => {
    if (!content) throw new Error('EMPTY_CLIPBOARD_CONTENT');
    return typeof content === 'string'
      ? { plainText: content, html: content, markdown: content }
      : content;
  });
  try {
    if (!CLIPBOARD_ITEM_SUPPORTED || !navigator.clipboard.write) throw new Error('CLIPBOARD_ITEM_UNSUPPORTED');

    if (textFormat) {
      const plainTextPromise = contentPromise.then((content) => content[textFormat]);
      await navigator.clipboard.write([buildPlainTextClipboardItem(plainTextPromise)]);
    } else {
      const canWriteMarkdown = !ClipboardItem.supports || ClipboardItem.supports('text/markdown');
      await navigator.clipboard.write([buildTextClipboardItem(contentPromise, canWriteMarkdown)]);
    }
  } catch {
    try {
      const content = await contentPromise;
      if (!textFormat && CLIPBOARD_ITEM_SUPPORTED) {
        try {
          await navigator.clipboard.write([buildTextClipboardItem(content)]);
          onSuccess?.();
          return;
        } catch {
          // Fall through to the synchronous plain-text fallback
        }
      }
      if (!copyTextToClipboard(textFormat ? content[textFormat] : content.plainText)) {
        throw new Error('CLIPBOARD_WRITE_FAILED');
      }
    } catch {
      onFailure?.();
      return;
    }
  }

  onSuccess?.();
}

function buildPlainTextClipboardItem(content: string | Promise<string>) {
  return new ClipboardItem({
    'text/plain': buildPlainTextClipboardBlob(content),
  });
}

function buildTextClipboardItem(
  content: ClipboardTextContent | Promise<ClipboardTextContent>,
  withMarkdown = false,
) {
  const data: Record<string, Blob | Promise<Blob>> = {
    'text/plain': buildClipboardBlob(content, 'plainText', 'text/plain'),
    'text/html': buildClipboardBlob(content, 'html', 'text/html'),
  };
  if (withMarkdown) {
    data['text/markdown'] = buildClipboardBlob(content, 'markdown', 'text/markdown');
  }

  return new ClipboardItem(data);
}

function buildClipboardBlob(
  content: ClipboardTextContent | Promise<ClipboardTextContent>,
  key: keyof ClipboardTextContent,
  type: string,
): Blob | Promise<Blob> {
  if (content instanceof Promise) return content.then((value) => buildClipboardBlob(value, key, type));
  const value = content[key];
  if (!content.plainText) throw new Error('EMPTY_CLIPBOARD_CONTENT');
  return new Blob([value], { type });
}

function buildPlainTextClipboardBlob(content: string | Promise<string>): Blob | Promise<Blob> {
  if (content instanceof Promise) return content.then(buildPlainTextClipboardBlob);
  if (!content) throw new Error('EMPTY_CLIPBOARD_CONTENT');
  return new Blob([content], { type: 'text/plain' });
}

async function copyBlobToClipboard(pngBlob: Blob | null) {
  if (!pngBlob || !CLIPBOARD_ITEM_SUPPORTED) {
    return;
  }

  try {
    await window.navigator.clipboard.write?.([
      new ClipboardItem({
        [pngBlob.type]: pngBlob,
      }),
    ]);
  } catch (error) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error(error);
    }
  }
}
