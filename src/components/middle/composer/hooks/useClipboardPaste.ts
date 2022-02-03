import { StateHookSetter, useEffect } from '../../../../lib/teact/teact';
import { ApiAttachment, ApiMessage } from '../../../../api/types';

import buildAttachment from '../helpers/buildAttachment';
import { EDITABLE_INPUT_ID, EDITABLE_INPUT_MODAL_ID } from '../../../../config';
import getFilesFromDataTransferItems from '../helpers/getFilesFromDataTransferItems';

const CLIPBOARD_ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif'];
const MAX_MESSAGE_LENGTH = 4096;

const useClipboardPaste = (
  insertTextAndUpdateCursor: (text: string, inputId?: string) => void,
  setAttachments: StateHookSetter<ApiAttachment[]>,
  editedMessage: ApiMessage | undefined,
) => {
  useEffect(() => {
    async function handlePaste(e: ClipboardEvent) {
      if (!e.clipboardData) {
        return;
      }

      const input = document.activeElement;
      if (input && ![EDITABLE_INPUT_ID, EDITABLE_INPUT_MODAL_ID].includes(input.id)) {
        return;
      }

      e.preventDefault();

      const pastedText = e.clipboardData.getData('text').substring(0, MAX_MESSAGE_LENGTH);
      const { items } = e.clipboardData;
      let files: File[] = [];

      if (items.length > 0) {
        files = await getFilesFromDataTransferItems(items);
      }

      if (files.length === 0 && !pastedText) {
        return;
      }

      if (files.length > 0 && !editedMessage) {
        const newAttachments = await Promise.all(files.map((file) => {
          return buildAttachment(file.name, file, files.length === 1 && CLIPBOARD_ACCEPTED_TYPES.includes(file.type));
        }));
        setAttachments((attachments) => attachments.concat(newAttachments));
      }

      if (pastedText) {
        insertTextAndUpdateCursor(pastedText, input?.id);
      }
    }

    document.addEventListener('paste', handlePaste, false);

    return () => {
      document.removeEventListener('paste', handlePaste, false);
    };
  }, [insertTextAndUpdateCursor, editedMessage, setAttachments]);
};

export default useClipboardPaste;
