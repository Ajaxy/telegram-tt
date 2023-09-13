import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiUser } from '../../api/types';

import { getUserFullName } from '../../global/helpers';
import renderText from '../common/helpers/renderText';

import useLang from '../../hooks/useLang';
import usePrevious from '../../hooks/usePrevious';

import Checkbox from '../ui/Checkbox';
import ConfirmDialog from '../ui/ConfirmDialog';

export type OwnProps = {
  bot?: ApiUser;
  type?: 'game' | 'webApp' | 'botApp';
  shouldRequestWriteAccess?: boolean;
};

const BotTrustModal: FC<OwnProps> = ({ bot, type, shouldRequestWriteAccess }) => {
  const { cancelBotTrustRequest, markBotTrusted } = getActions();

  const [isWriteAllowed, setIsWriteAllowed] = useState(shouldRequestWriteAccess || false);

  const lang = useLang();
  // Keep props a little bit longer, to show correct text on closing animation
  const previousBot = usePrevious(bot, false);
  const previousType = usePrevious(type, false);
  const currentBot = bot || previousBot;
  const currentType = type || previousType;

  const handleBotTrustAccept = useCallback(() => {
    markBotTrusted({ botId: bot!.id, isWriteAllowed });
  }, [markBotTrusted, isWriteAllowed, bot]);

  const handleBotTrustDecline = useCallback(() => {
    cancelBotTrustRequest();
  }, []);

  const title = currentType === 'game' ? lang('AppName') : lang('BotOpenPageTitle');
  const text = useMemo(() => {
    switch (currentType) {
      case 'game':
        return lang('BotPermissionGameAlert', getUserFullName(currentBot));
      case 'webApp':
        return lang('BotOpenPageMessage', getUserFullName(currentBot));
      case 'botApp':
      default:
        return lang('BotWebViewStartPermission');
    }
  }, [currentBot, currentType, lang]);

  return (
    <ConfirmDialog
      isOpen={Boolean(bot)}
      onClose={handleBotTrustDecline}
      title={title}
      confirmHandler={handleBotTrustAccept}
    >
      {renderText(text, ['simple_markdown'])}
      {shouldRequestWriteAccess && (
        <Checkbox
          className="dialog-checkbox"
          checked={isWriteAllowed}
          label={renderText(
            lang('WebApp.AddToAttachmentAllowMessages', currentBot?.firstName),
            ['simple_markdown'],
          )}
          onCheck={setIsWriteAllowed}
        />
      )}
    </ConfirmDialog>
  );
};

export default memo(BotTrustModal);
