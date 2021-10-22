import { useCallback, useEffect } from '../../../../lib/teact/teact';

import { ApiMessage } from '../../../../api/types';
import { GlobalActions } from '../../../../global/types';

import { EDITABLE_INPUT_ID } from '../../../../config';
import parseMessageInput from '../../../../util/parseMessageInput';
import getMessageTextAsHtml from '../helpers/getMessageTextAsHtml';
import focusEditableElement from '../../../../util/focusEditableElement';
import { hasMessageMedia } from '../../../../modules/helpers';

export default (
  htmlRef: { current: string },
  setHtml: (html: string) => void,
  editedMessage: ApiMessage | undefined,
  resetComposer: () => void,
  openDeleteModal: () => void,
  editMessage: GlobalActions['editMessage'],
) => {
  // TODO useOnChange
  // Handle editing message
  useEffect(() => {
    if (!editedMessage) {
      setHtml('');
      return;
    }

    setHtml(getMessageTextAsHtml(editedMessage.content.text));

    requestAnimationFrame(() => {
      const messageInput = document.getElementById(EDITABLE_INPUT_ID)!;
      focusEditableElement(messageInput, true);
    });
  }, [editedMessage, setHtml]);

  const handleEditComplete = useCallback(() => {
    const { text, entities } = parseMessageInput(htmlRef.current!);

    if (!editedMessage) {
      return;
    }

    if (!text && !hasMessageMedia(editedMessage)) {
      openDeleteModal();
      return;
    }

    editMessage({
      messageId: editedMessage.id,
      text,
      entities,
    });

    resetComposer();
  }, [editMessage, editedMessage, htmlRef, openDeleteModal, resetComposer]);

  return handleEditComplete;
};
