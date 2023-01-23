import React, {
  memo, useCallback, useEffect, useState,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { FC } from '../../lib/teact/teact';
import type { ApiAttachBot } from '../../api/types';

import renderText from '../common/helpers/renderText';

import useLang from '../../hooks/useLang';
import usePrevious from '../../hooks/usePrevious';

import ConfirmDialog from '../ui/ConfirmDialog';
import Checkbox from '../ui/Checkbox';

export type OwnProps = {
  bot?: ApiAttachBot;
};

const AttachBotInstallModal: FC<OwnProps> = ({
  bot,
}) => {
  const { confirmAttachBotInstall, cancelAttachBotInstall } = getActions();
  const [isWriteAllowed, setIsWriteAllowed] = useState(bot?.shouldRequestWriteAccess || false);

  const lang = useLang();

  const prevBot = usePrevious(bot);
  const renderingBot = bot || prevBot;

  const handleConfirm = useCallback(() => {
    confirmAttachBotInstall({
      isWriteAllowed,
    });
  }, [confirmAttachBotInstall, isWriteAllowed]);

  // Reset on re-open
  useEffect(() => {
    if (bot) {
      setIsWriteAllowed(bot.shouldRequestWriteAccess ?? false);
    }
  }, [bot]);

  return (
    <ConfirmDialog
      isOpen={Boolean(bot)}
      onClose={cancelAttachBotInstall}
      title={renderingBot?.shortName}
      confirmHandler={handleConfirm}
    >
      {lang('WebApp.AddToAttachmentText', renderingBot?.shortName)}
      {renderingBot?.shouldRequestWriteAccess && (
        <Checkbox
          className="dialog-checkbox"
          checked={isWriteAllowed}
          label={renderText(
            lang('WebApp.AddToAttachmentAllowMessages', renderingBot?.shortName),
            ['simple_markdown'],
          )}
          onCheck={setIsWriteAllowed}
        />
      )}
    </ConfirmDialog>
  );
};

export default memo(AttachBotInstallModal);
