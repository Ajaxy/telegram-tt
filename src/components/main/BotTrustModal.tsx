import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiUser } from '../../api/types';

import { getUserFullName } from '../../global/helpers';
import renderText from '../common/helpers/renderText';

import useOldLang from '../../hooks/useOldLang';

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

  const lang = useOldLang();

  const handleBotTrustAccept = useCallback(() => {
    markBotTrusted({ botId: bot!.id, isWriteAllowed });
  }, [markBotTrusted, isWriteAllowed, bot]);

  const handleBotTrustDecline = useCallback(() => {
    cancelBotTrustRequest();
  }, []);

  const title = type === 'game' ? lang('AppName') : lang('BotOpenPageTitle');
  const text = useMemo(() => {
    switch (type) {
      case 'game':
        return lang('BotPermissionGameAlert', getUserFullName(bot));
      case 'webApp':
        return lang('BotOpenPageMessage', getUserFullName(bot));
      case 'botApp':
      default:
        return lang('BotWebViewStartPermission');
    }
  }, [bot, type, lang]);

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
            lang('WebApp.AddToAttachmentAllowMessages', bot?.firstName),
            ['simple_markdown'],
          )}
          onCheck={setIsWriteAllowed}
        />
      )}
    </ConfirmDialog>
  );
};

export default memo(BotTrustModal);
