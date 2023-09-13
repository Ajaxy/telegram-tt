import type { FC } from '../../lib/teact/teact';
import React, { memo, useEffect } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiContact, ApiError, ApiInviteInfo, ApiPhoto,
} from '../../api/types';
import type { MessageList } from '../../global/types';

import { selectCurrentMessageList, selectTabState } from '../../global/selectors';
import getReadableErrorText from '../../util/getReadableErrorText';
import { pick } from '../../util/iteratees';
import renderText from '../common/helpers/renderText';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';

import Avatar from '../common/Avatar';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

type StateProps = {
  currentMessageList?: MessageList;
  dialogs: (ApiError | ApiInviteInfo | ApiContact)[];
};

const Dialogs: FC<StateProps> = ({ dialogs, currentMessageList }) => {
  const {
    dismissDialog,
    acceptInviteConfirmation,
    sendMessage,
    showNotification,
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

  function renderInviteHeader(title: string, photo?: ApiPhoto) {
    return (
      <div className="modal-header">
        {photo && <Avatar size="small" photo={photo} withVideo />}
        <div className="modal-title">
          {renderText(title)}
        </div>
        <Button round color="translucent" size="smaller" ariaLabel={lang('Close')} onClick={closeModal}>
          <i className="icon icon-close" />
        </Button>
      </div>
    );
  }

  const renderInvite = (invite: ApiInviteInfo) => {
    const {
      hash, title, about, participantsCount, isChannel, photo, isRequestNeeded,
    } = invite;

    const handleJoinClick = () => {
      acceptInviteConfirmation({
        hash,
      });
      if (isRequestNeeded) {
        showNotification({
          message: isChannel ? lang('RequestToJoinChannelSentDescription') : lang('RequestToJoinGroupSentDescription'),
        });
      }
      closeModal();
    };

    const participantsText = isChannel
      ? lang('Subscribers', participantsCount, 'i')
      : lang('Members', participantsCount, 'i');

    const joinText = isChannel ? lang('ChannelJoin') : lang('JoinGroup');
    const requestToJoinText = isChannel
      ? lang('MemberRequests.RequestToJoinChannel') : lang('MemberRequests.RequestToJoinGroup');

    return (
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        className="error"
        header={renderInviteHeader(title, photo)}
        onCloseAnimationEnd={dismissDialog}
      >
        {participantsCount !== undefined && <p className="modal-help">{participantsText}</p>}
        {about && <p className="modal-about">{renderText(about, ['br'])}</p>}
        {isRequestNeeded && (
          <p className="modal-help">
            {isChannel
              ? lang('MemberRequests.RequestToJoinDescriptionChannel')
              : lang('MemberRequests.RequestToJoinDescriptionGroup')}
          </p>
        )}
        <div className="dialog-buttons mt-2">
          <Button
            isText
            className="confirm-dialog-button"
            // eslint-disable-next-line react/jsx-no-bind
            onClick={handleJoinClick}
          >
            {isRequestNeeded ? requestToJoinText : joinText}
          </Button>
          <Button isText className="confirm-dialog-button" onClick={closeModal}>{lang('Cancel')}</Button>
        </div>
      </Modal>
    );
  };

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

  const renderDialog = (dialog: ApiError | ApiInviteInfo | ApiContact) => {
    if ('hash' in dialog) {
      return renderInvite(dialog);
    }

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
