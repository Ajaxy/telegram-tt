import { StateHookSetter, useEffect } from '../../../../lib/teact/teact';
import { ApiAttachment, ApiMessage } from '../../../../api/types';

import buildAttachment from '../helpers/buildAttachment';
import { EDITABLE_INPUT_ID, EDITABLE_INPUT_MODAL_ID } from '../../../../config';

const CLIPBOARD_ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif'];
const MAX_MESSAGE_LENGTH = 4096;

export default (
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

      const { items } = e.clipboardData;
      const media = Array.from(items).find((item) => CLIPBOARD_ACCEPTED_TYPES.includes(item.type) && item.kind == "file");
      const file = media && media.getAsFile();
      const pastedText = e.clipboardData.getData('text').substring(0, MAX_MESSAGE_LENGTH);

      if (!file && !pastedText) {
        return;
      }

      e.preventDefault();

      if (file && !editedMessage) {
        const attachment = await buildAttachment(file.name, file, true);
        setAttachments((attachments) => [
          ...attachments,
          attachment,
        ]);
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
