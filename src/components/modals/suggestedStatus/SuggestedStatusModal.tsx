import React, { memo, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiUser } from '../../../api/types';
import type { TabState } from '../../../global/types';

import { getUserFullName } from '../../../global/helpers';
import { selectUser } from '../../../global/selectors';
import { formatShortDuration } from '../../../util/dates/dateFormat';
import { getServerTime } from '../../../util/serverTime';
import { REM } from '../../common/helpers/mediaDimensions';

import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import CustomEmoji from '../../common/CustomEmoji';
import PeerChip from '../../common/PeerChip';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';

import styles from './SuggestedStatusModal.module.scss';

export type OwnProps = {
  modal: TabState['suggestedStatusModal'];
};

type StateProps = {
  bot?: ApiUser;
  currentUser?: ApiUser;
};

const CUSTOM_EMOJI_SIZE = 6 * REM;

const SuggestedStatusModal = ({ modal, currentUser, bot }: OwnProps & StateProps) => {
  const { setEmojiStatus, closeSuggestedStatusModal, sendWebAppEvent } = getActions();

  const lang = useLang();

  const isOpen = Boolean(modal);
  const renderingModal = useCurrentOrPrev(modal);

  const mockPeerWithStatus = useMemo(() => {
    if (!currentUser || !renderingModal) return undefined;
    return {
      ...currentUser,
      emojiStatus: {
        type: 'regular',
        documentId: renderingModal.customEmojiId,
      },
    } satisfies ApiUser;
  }, [currentUser, renderingModal]);

  const description = useMemo(() => {
    if (!renderingModal || !bot) return undefined;

    const botName = getUserFullName(bot);

    if (renderingModal.duration) {
      return lang('BotSuggestedStatusFor', {
        bot: botName,
        duration: formatShortDuration(lang, renderingModal.duration),
      }, {
        withNodes: true,
        withMarkdown: true,
      });
    }

    return lang('BotSuggestedStatus', { bot: botName }, { withNodes: true, withMarkdown: true });
  }, [bot, lang, renderingModal]);

  const handleClose = useLastCallback(() => {
    const webAppKey = renderingModal?.webAppKey;

    if (webAppKey) {
      sendWebAppEvent({
        webAppKey,
        event: {
          eventType: 'emoji_status_failed',
          eventData: {
            error: 'USER_DECLINED',
          },
        },
      });
    }

    closeSuggestedStatusModal();
  });

  const handleSetStatus = useLastCallback(() => {
    if (!renderingModal) return;

    const expires = renderingModal.duration ? getServerTime() + renderingModal.duration : undefined;

    setEmojiStatus({
      referrerWebAppKey: renderingModal.webAppKey,
      emojiStatus: { type: 'regular', documentId: renderingModal.customEmojiId, until: expires },
    });
    closeSuggestedStatusModal();
  });

  return (
    <Modal
      isOpen={isOpen}
      contentClassName={styles.content}
      hasAbsoluteCloseButton
      isSlim
      onClose={handleClose}
    >
      {renderingModal && (
        <CustomEmoji
          className={styles.topEmoji}
          documentId={renderingModal.customEmojiId}
          size={CUSTOM_EMOJI_SIZE}
          loopLimit={1}
          forceAlways
        />
      )}
      <div>
        <h3 className={styles.title}>{lang('BotSuggestedStatusTitle')}</h3>
        <p className={styles.description}>{description}</p>
      </div>
      {mockPeerWithStatus && (
        <PeerChip
          mockPeer={mockPeerWithStatus}
          withEmojiStatus
        />
      )}
      <Button size="smaller" onClick={handleSetStatus}>
        {lang('GeneralConfirm')}
      </Button>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): StateProps => {
    const currentUser = selectUser(global, global.currentUserId!);
    const bot = modal?.botId ? selectUser(global, modal.botId) : undefined;

    return {
      currentUser,
      bot,
    };
  },
)(SuggestedStatusModal));
