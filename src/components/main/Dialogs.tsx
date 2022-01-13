import React, { FC, memo, useEffect } from '../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../lib/teact/teactn';

import { ApiError, ApiInviteInfo, ApiPhoto } from '../../api/types';

import getReadableErrorText from '../../util/getReadableErrorText';
import { pick } from '../../util/iteratees';
import renderText from '../common/helpers/renderText';
import useLang from '../../hooks/useLang';
import useFlag from '../../hooks/useFlag';

import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Avatar from '../common/Avatar';

import './Dialogs.scss';

type StateProps = {
  dialogs: (ApiError | ApiInviteInfo)[];
};

const Dialogs: FC<StateProps> = ({ dialogs }) => {
  const { dismissDialog, acceptInviteConfirmation } = getDispatch();
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
        {photo && <Avatar size="small" photo={photo} />}
        <div className="modal-title">
          {renderText(title)}
        </div>
        <Button round color="translucent" size="smaller" ariaLabel={lang('Close')} onClick={closeModal}>
          <i className="icon-close" />
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
        {about && <p className="modal-about">{renderText(about)}</p>}
        {participantsCount !== undefined && <p>{participantsText}</p>}
        {isRequestNeeded && (
          <p className="modal-help">
            {isChannel
              ? lang('MemberRequests.RequestToJoinDescriptionChannel')
              : lang('MemberRequests.RequestToJoinDescriptionGroup')}
          </p>
        )}
        <Button isText className="confirm-dialog-button" onClick={handleJoinClick}>
          {isRequestNeeded ? requestToJoinText : joinText}
        </Button>
        <Button isText className="confirm-dialog-button" onClick={closeModal}>{lang('Cancel')}</Button>
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
        {error.hasErrorKey ? getReadableErrorText(error) : renderText(error.message!, ['emoji', 'br'])}
        <div>
          <Button isText onClick={closeModal}>{lang('OK')}</Button>
        </div>
      </Modal>
    );
  };

  const renderDialog = (dialog: ApiError | ApiInviteInfo) => {
    if ('hash' in dialog) {
      return renderInvite(dialog);
    }

    return renderError(dialog);
  };

  return (
    <div id="Dialogs">
      {Boolean(dialogs.length) && renderDialog(dialogs[dialogs.length - 1])}
    </div>
  );
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
  (global): StateProps => pick(global, ['dialogs']),
)(Dialogs));
