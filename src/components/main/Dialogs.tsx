import type { FC } from '../../lib/teact/teact';
import React, { memo, useEffect } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiContact, ApiError,
} from '../../api/types';
import type { MessageList } from '../../global/types';

import { selectCurrentMessageList, selectTabState } from '../../global/selectors';
import getReadableErrorText from '../../util/getReadableErrorText';
import { pick } from '../../util/iteratees';
import renderText from '../common/helpers/renderText';

import useFlag from '../../hooks/useFlag';
import useOldLang from '../../hooks/useOldLang';

import Button from '../ui/Button';
import Modal from '../ui/Modal';

type StateProps = {
  currentMessageList?: MessageList;
  dialogs: (ApiError | ApiContact)[];
};

const Dialogs: FC<StateProps> = ({ dialogs, currentMessageList }) => {
  const {
    dismissDialog,
    sendMessage,
  } = getActions();
  const [isModalOpen, openModal, closeModal] = useFlag();

  const lang = useOldLang();

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
        contact: pick(contactRequest, ['firstName', 'lastName', 'phoneNumber']),
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
        {lang('AreYouSureShareMyContactInfoBot')}
        <div className="dialog-buttons mt-2">
          <Button
            className="confirm-dialog-button"
            isText
            // eslint-disable-next-line react/jsx-no-bind
            onClick={handleConfirm}
          >
            {lang('OK')}
          </Button>
          <Button className="confirm-dialog-button" isText onClick={closeModal}>{lang('Cancel')}</Button>
        </div>
      </Modal>
    );
  };

  const renderError = (error: ApiError) => {
    return (
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        onCloseAnimationEnd={dismissDialog}
        className="error"
        title={getErrorHeader(error)}
      >
        {error.hasErrorKey ? getReadableErrorText(error)
          : renderText(error.message!, ['simple_markdown', 'emoji', 'br'])}
        <div className="dialog-buttons mt-2">
          <Button isText onClick={closeModal}>{lang('OK')}</Button>
        </div>
      </Modal>
    );
  };

  const renderDialog = (dialog: ApiError | ApiContact) => {
    if ('phoneNumber' in dialog) {
      return renderContactRequest(dialog);
    }

    return renderError(dialog);
  };

  return Boolean(dialogs.length) && renderDialog(dialogs[dialogs.length - 1]);
};

function getErrorHeader(error: ApiError) {
  if (error.isSlowMode) {
    return 'Slowmode enabled';
  }

  if (!error.hasErrorKey) {
    return 'Telegram';
  }

  return 'Something went wrong';
}

export default memo(withGlobal(
  (global): StateProps => {
    return {
      dialogs: selectTabState(global).dialogs,
      currentMessageList: selectCurrentMessageList(global),
    };
  },
)(Dialogs));
