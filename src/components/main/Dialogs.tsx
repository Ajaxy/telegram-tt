import type { TeactNode } from '../../lib/teact/teact';
import { memo, useEffect } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiContact,
  ApiDialog,
  ApiDialogError,
  ApiDialogLocalizedMessage,
  ApiDialogMessage,
} from '../../api/types';
import type { MessageList } from '../../types';

import { selectCurrentMessageList, selectTabState } from '../../global/selectors';
import getReadableErrorText from '../../util/getReadableErrorText';
import { renderTextWithEntities } from '../common/helpers/renderTextWithEntities';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';

import Button from '../ui/Button';
import Modal from '../ui/Modal';

type StateProps = {
  currentMessageList?: MessageList;
  dialogs: ApiDialog[];
};

const Dialogs = ({ dialogs, currentMessageList }: StateProps) => {
  const {
    dismissDialog,
    sendMessage,
  } = getActions();
  const [isModalOpen, openModal, closeModal] = useFlag();

  const lang = useLang();

  useEffect(() => {
    if (dialogs.length > 0) {
      openModal();
    }
  }, [dialogs, openModal]);

  if (!dialogs.length) {
    return undefined;
  }

  const renderContactRequest = (contactRequest: ApiContact) => {
    const handleConfirm = () => {
      if (!currentMessageList) {
        return;
      }

      sendMessage({
        contact: contactRequest,
        messageList: currentMessageList,
      });
      closeModal();
    };

    return (
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        className="confirm"
        title={lang('ShareYouPhoneNumberTitle')}
        onCloseAnimationEnd={dismissDialog}
      >
        {lang(
          'AreYouSureShareMyContactInfoBot',
          undefined,
          { withNodes: true, withMarkdown: true, renderTextFilters: ['br'],
          })}
        <div className="dialog-buttons mt-2">
          <Button
            className="confirm-dialog-button"
            isText

            onClick={handleConfirm}
          >
            {lang('OK')}
          </Button>
          <Button className="confirm-dialog-button" isText onClick={closeModal}>{lang('Cancel')}</Button>
        </div>
      </Modal>
    );
  };

  const renderTextDialog = (renderedText: TeactNode, title = 'Telegram') => {
    return (
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        onCloseAnimationEnd={dismissDialog}
        className="error"
        title={title}
      >
        {renderedText}
        <div className="dialog-buttons mt-2">
          <Button isText onClick={closeModal}>{lang('OK')}</Button>
        </div>
      </Modal>
    );
  };

  const renderFormattedTextDialog = (dialog: ApiDialogMessage, title?: string) => {
    const renderedText = renderTextWithEntities(dialog.text);

    return renderTextDialog(renderedText, title);
  };

  const renderLocalizedDialog = (dialog: ApiDialogLocalizedMessage, title?: string) => {
    return renderTextDialog(lang.with(dialog.text), title);
  };

  const renderError = (error: ApiDialogError) => {
    const renderedErrorMessage = error.hasErrorKey
      ? getReadableErrorText(error)
      : error.entities?.length
        ? renderTextWithEntities({ text: error.message, entities: error.entities })
        : error.message;

    return renderTextDialog(renderedErrorMessage, getErrorHeader(error));
  };

  const renderDialog = (dialog: ApiDialog) => {
    if (dialog.type === 'contact') {
      return renderContactRequest(dialog.contact);
    }

    if (dialog.type === 'message') {
      return renderFormattedTextDialog(dialog);
    }

    if (dialog.type === 'localized') {
      return renderLocalizedDialog(dialog);
    }

    return renderError(dialog);
  };

  return Boolean(dialogs.length) && renderDialog(dialogs[dialogs.length - 1]);
};

function getErrorHeader(error: ApiDialogError) {
  if (error.isSlowMode) {
    return 'Slowmode enabled';
  }

  if (!error.hasErrorKey) {
    return 'Telegram';
  }

  return 'Something went wrong';
}

export default memo(withGlobal(
  (global): Complete<StateProps> => {
    return {
      dialogs: selectTabState(global).dialogs,
      currentMessageList: selectCurrentMessageList(global),
    };
  },
)(Dialogs));
