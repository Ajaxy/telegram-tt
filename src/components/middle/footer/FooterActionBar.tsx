import { memo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { IconName } from '../../../types/icons';

import { MUTE_INDEFINITE_TIMESTAMP, UNMUTE_TIMESTAMP } from '../../../config';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Button from '../../ui/Button';

import styles from './FooterActionBar.module.scss';

type OwnProps = {
  chatId: string;
  isChannel?: boolean;
  canSubscribe?: boolean;
  shouldJoinToSend?: boolean;
  shouldSendJoinRequest?: boolean;
  canStartBot?: boolean;
  canRestartBot?: boolean;
  canUnblock?: boolean;
  isChannelMuteBar?: boolean;
  isMuted?: boolean;
  linkedMonoforumId?: string;
  areGiftsAvailable?: boolean;
  canUnpinAll?: boolean;
  pinnedMessagesCount?: number;
  canOpenSavedChat?: boolean;
  savedChatId?: string;
  onUnpinAll?: NoneToVoidFunction;
};

type MainButton = {
  key: string;
  label: string;
  iconName?: IconName;
  isPrimary: boolean;
  onClick: NoneToVoidFunction;
};

const FooterActionBar = ({
  chatId,
  isChannel,
  canSubscribe,
  shouldJoinToSend,
  shouldSendJoinRequest,
  canStartBot,
  canRestartBot,
  canUnblock,
  isChannelMuteBar,
  isMuted,
  linkedMonoforumId,
  areGiftsAvailable,
  canUnpinAll,
  pinnedMessagesCount,
  canOpenSavedChat,
  savedChatId,
  onUnpinAll,
}: OwnProps) => {
  const {
    joinChannel,
    sendBotCommand,
    restartBot,
    unblockUser,
    updateChatMutedState,
    openChat,
    openGiftModal,
  } = getActions();

  const lang = useLang();

  const handleSubscribeClick = useLastCallback(() => {
    joinChannel({ chatId });
  });

  const handleStartBot = useLastCallback(() => {
    sendBotCommand({ command: '/start' });
  });

  const handleRestartBot = useLastCallback(() => {
    restartBot({ chatId });
  });

  const handleUnblock = useLastCallback(() => {
    unblockUser({ userId: chatId });
  });

  const handleToggleMute = useLastCallback(() => {
    updateChatMutedState({ chatId, mutedUntil: isMuted ? UNMUTE_TIMESTAMP : MUTE_INDEFINITE_TIMESTAMP });
  });

  const handleOpenDirect = useLastCallback(() => {
    openChat({ id: linkedMonoforumId });
  });

  const handleOpenGift = useLastCallback(() => {
    openGiftModal({ forUserId: chatId });
  });

  const handleOpenSavedChat = useLastCallback(() => {
    openChat({ id: savedChatId! });
  });

  const mainButton: MainButton | undefined = (() => {
    if (canUnpinAll) {
      return {
        key: 'unpinAll',
        label: lang('ChatPinnedUnpinAll', { count: pinnedMessagesCount! }, {
          pluralValue: pinnedMessagesCount!,
        }),
        iconName: 'unpin',
        isPrimary: false,
        onClick: onUnpinAll!,
      };
    }
    if (canOpenSavedChat) {
      return {
        key: 'openSavedChat',
        label: lang('SavedOpenChat'),
        isPrimary: true,
        onClick: handleOpenSavedChat,
      };
    }
    if (shouldSendJoinRequest) {
      return {
        key: 'ChannelJoinRequest',
        label: lang('ChannelJoinRequest'),
        isPrimary: true,
        onClick: handleSubscribeClick,
      };
    }
    if (canSubscribe || shouldJoinToSend) {
      return {
        key: isChannel ? 'ProfileJoinChannel' : 'ProfileJoinGroup',
        label: lang(isChannel ? 'ProfileJoinChannel' : 'ProfileJoinGroup'),
        isPrimary: true,
        onClick: handleSubscribeClick,
      };
    }
    if (canStartBot) {
      return { key: 'BotStart', label: lang('BotStart'), isPrimary: true, onClick: handleStartBot };
    }
    if (canRestartBot) {
      return { key: 'BotRestart', label: lang('BotRestart'), isPrimary: true, onClick: handleRestartBot };
    }
    if (canUnblock) {
      return { key: 'Unblock', label: lang('Unblock'), isPrimary: true, onClick: handleUnblock };
    }
    if (isChannelMuteBar) {
      return {
        key: isMuted ? 'ChatsUnmute' : 'ChatsMute',
        label: lang(isMuted ? 'ChatsUnmute' : 'ChatsMute'),
        isPrimary: false,
        onClick: handleToggleMute,
      };
    }

    return undefined;
  })();

  if (!mainButton) {
    return undefined;
  }

  const withChannelSideActions = !canUnpinAll && !canOpenSavedChat;
  const withDirect = Boolean(withChannelSideActions && isChannel && linkedMonoforumId);
  const withGift = Boolean(withChannelSideActions && isChannel && areGiftsAvailable);

  return (
    <div className={styles.root} data-footer-action-bar dir={lang.isRtl ? 'rtl' : undefined}>
      <div className={styles.plate}>
        {withDirect && (
          <div className={styles.sideSlot}>
            <Button
              round
              color="translucent"
              className={styles.sideButton}
              ariaLabel={lang('ChannelSendMessage')}
              iconName="direct"
              onClick={handleOpenDirect}
            />
          </div>
        )}
        <Button
          key={mainButton.key}
          fluid
          ripple
          color={mainButton.isPrimary ? 'primary' : 'secondary'}
          className={styles.centerButton}
          size="smaller"
          iconName={mainButton.iconName}
          noForcedUpperCase
          onClick={mainButton.onClick}
        >
          {mainButton.label}
        </Button>
        {withGift && (
          <div className={styles.sideSlot}>
            <Button
              round
              color="translucent"
              className={styles.sideButton}
              ariaLabel={lang('ProfileSendAGift')}
              iconName="closed-gift"
              onClick={handleOpenGift}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(FooterActionBar);
