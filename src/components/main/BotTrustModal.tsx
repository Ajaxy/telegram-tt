import React, { FC, memo, useCallback } from '../../lib/teact/teact';
import { getActions } from '../../global';

import { ApiUser } from '../../api/types';

import { getUserFullName } from '../../global/helpers';
import renderText from '../common/helpers/renderText';

import useLang from '../../hooks/useLang';
import usePrevious from '../../hooks/usePrevious';

import ConfirmDialog from '../ui/ConfirmDialog';

export type OwnProps = {
  bot?: ApiUser;
  type?: 'game' | 'webApp';
};

const BotTrustModal: FC<OwnProps> = ({ bot, type }) => {
  const { cancelBotTrustRequest, markBotTrusted } = getActions();
  const lang = useLang();
  // Keep props a little bit longer, to show correct text on closing animation
  const previousBot = usePrevious(bot, false);
  const previousType = usePrevious(type, false);
  const currentBot = bot || previousBot;
  const currentType = type || previousType;

  const handleBotTrustAccept = useCallback(() => {
    markBotTrusted({ botId: bot!.id });
  }, [markBotTrusted, bot]);

  const title = currentType === 'game' ? lang('AppName') : lang('BotOpenPageTitle');
  const text = currentType === 'game' ? lang('BotPermissionGameAlert', getUserFullName(currentBot))
    : lang('BotOpenPageMessage', getUserFullName(currentBot));

  return (
    <ConfirmDialog
      isOpen={Boolean(bot)}
      onClose={cancelBotTrustRequest}
      confirmHandler={handleBotTrustAccept}
      title={title}
      textParts={renderText(text, ['br', 'simple_markdown'])}
    />
  );
};

export default memo(BotTrustModal);
