import { useCallback, useEffect } from '../../../../lib/teact/teact';
import { getDispatch } from '../../../../lib/teact/teactn';

import { ApiMessage } from '../../../../api/types';

import { EDITABLE_INPUT_ID } from '../../../../config';
import parseMessageInput from '../../../../util/parseMessageInput';
import focusEditableElement from '../../../../util/focusEditableElement';
import { hasMessageMedia } from '../../../../modules/helpers';
import { getTextWithEntitiesAsHtml } from '../../../common/helpers/renderTextWithEntities';

const useEditing = (
  htmlRef: { current: string },
  setHtml: (html: string) => void,
  editedMessage: ApiMessage | undefined,
  resetComposer: () => void,
  openDeleteModal: () => void,
) => {
  const { editMessage } = getDispatch();

  // TODO useOnChange
  // Handle editing message
  useEffect(() => {
    if (!editedMessage) {
      setHtml('');
      return;
    }

    setHtml(getTextWithEntitiesAsHtml(editedMessage.content.text));

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

export default useEditing;
