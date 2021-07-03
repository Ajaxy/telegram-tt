import React, { FC, memo } from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';
import { ApiError, ApiInviteInfo } from '../../api/types';

import getReadableErrorText from '../../util/getReadableErrorText';
import { pick } from '../../util/iteratees';
import useLang from '../../hooks/useLang';

import Modal from '../ui/Modal';
import Button from '../ui/Button';

import './Dialogs.scss';

type StateProps = {
  dialogs: (ApiError | ApiInviteInfo)[];
};

type DispatchProps = Pick<GlobalActions, 'dismissDialog' | 'acceptInviteConfirmation'>;

const Dialogs: FC<StateProps & DispatchProps> = ({ dialogs, dismissDialog, acceptInviteConfirmation }) => {
  const lang = useLang();

  if (!dialogs.length) {
    return undefined;
  }

  const renderInvite = (invite: ApiInviteInfo) => {
    const {
      hash, title, participantsCount, isChannel,
    } = invite;

    const handleJoinClick = () => {
      acceptInviteConfirmation({
        hash,
      });
      dismissDialog();
    };

    const participantsText = isChannel
      ? lang('Subscribers', participantsCount, 'i')
      : lang('Members', participantsCount, 'i');

    const joinText = isChannel ? lang('ChannelJoin') : lang('JoinGroup');

    return (
      <Modal
        isOpen
        onClose={dismissDialog}
        className="error"
        title={title}
      >
        {participantsCount !== undefined && <p>{participantsText}</p>}
        <Button isText className="confirm-dialog-button" onClick={handleJoinClick}>{joinText}</Button>
        <Button isText className="confirm-dialog-button" onClick={dismissDialog}>{lang('Cancel')}</Button>
      </Modal>
    );
  };

  const renderError = (error: ApiError) => {
    return (
      <Modal
        isOpen
        onClose={dismissDialog}
        className="error"
        title={getErrorHeader(error)}
      >
        <p>{getReadableErrorText(error)}</p>
        <div className="buttons">
          <Button isText onClick={dismissDialog}>{lang('OK')}</Button>
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
      {dialogs.map(renderDialog)}
    </div>
  );
};

function getErrorHeader(error: ApiError) {
  if (error.isSlowMode) {
    return 'Slowmode enabled';
  }

  return 'Something went wrong';
}

export default memo(withGlobal(
  (global): StateProps => pick(global, ['dialogs']),
  (setGlobal, actions): DispatchProps => pick(actions, ['dismissDialog', 'acceptInviteConfirmation']),
)(Dialogs));
