import React, { FC } from '../../lib/teact/teact';
import { getActions } from '../../global';

import { ApiUser } from '../../api/types';

import useLang from '../../hooks/useLang';

import ConfirmDialog from '../ui/ConfirmDialog';

export type OwnProps = {
  bot?: ApiUser;
};

const BotAttachModal: FC<OwnProps> = ({
  bot,
}) => {
  const { closeBotAttachRequestModal, confirmBotAttachRequest } = getActions();

  const lang = useLang();

  const name = bot?.firstName;

  return (
    <ConfirmDialog
      isOpen={Boolean(bot)}
      onClose={closeBotAttachRequestModal}
      confirmHandler={confirmBotAttachRequest}
      title={name}
      textParts={lang('WebApp.AddToAttachmentText', name)}
    />
  );
};

export default BotAttachModal;
