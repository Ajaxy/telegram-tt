import React, { memo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { FC } from '../../lib/teact/teact';
import type { ApiUser } from '../../api/types';

import useLang from '../../hooks/useLang';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';

import ConfirmDialog from '../ui/ConfirmDialog';

export type OwnProps = {
  bot?: ApiUser;
};

const AttachBotInstallModal: FC<OwnProps> = ({
  bot,
}) => {
  const { cancelAttachBotInstall, confirmAttachBotInstall } = getActions();

  const lang = useLang();

  const name = useCurrentOrPrev(bot?.firstName, true);

  return (
    <ConfirmDialog
      isOpen={Boolean(bot)}
      onClose={cancelAttachBotInstall}
      confirmHandler={confirmAttachBotInstall}
      title={name}
      textParts={lang('WebApp.AddToAttachmentText', name)}
    />
  );
};

export default memo(AttachBotInstallModal);
