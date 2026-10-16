import {
  memo, useEffect,
  useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiStickerSet, ApiUser } from '../../../api/types';
import type { TabState } from '../../../global/types';

import { getUserFullName } from '../../../global/helpers';
import {
  selectIsCurrentUserFrozen, selectIsCurrentUserPremium, selectStickerSet, selectUser,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';

import useInterval from '../../../hooks/schedulers/useInterval';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import PeerChip from '../../common/PeerChip';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';

import styles from './EmojiStatusAccessModal.module.scss';

export type OwnProps = {
  modal: TabState['emojiStatusAccessModal'];
};

export type StateProps = {
  currentUser?: ApiUser;
  stickerSet?: ApiStickerSet;
  isPremium?: boolean;
  isAccountFrozen?: boolean;
};

const INTERVAL = 3200;

const EmojiStatusAccessModal = ({
  modal,
  currentUser,
  stickerSet,
  isPremium,
  isAccountFrozen,
}: OwnProps & StateProps) => {
  const {
    closeEmojiStatusAccessModal,
    toggleUserEmojiStatusPermission,
    sendWebAppEvent,
    openPremiumModal,
    loadDefaultStatusIcons,
  } = getActions();

  const isOpen = Boolean(modal);

  const lang = useLang();

  const containerRef = useRef<HTMLDivElement>();

  const [currentStatusIndex, setCurrentStatusIndex] = useState<number>(0);

  useEffect(() => {
    if (isOpen && !stickerSet?.stickers && !isAccountFrozen) {
      loadDefaultStatusIcons();
    }
  }, [isOpen, stickerSet, isAccountFrozen]);

  const mockPeerWithStatus = useMemo(() => {
    if (!currentUser || !stickerSet?.stickers) return undefined;
    return {
      ...currentUser,
      emojiStatus: {
        type: 'regular',
        documentId: stickerSet.stickers[currentStatusIndex].id,
      },
    } satisfies ApiUser;
  }, [currentUser, stickerSet, currentStatusIndex]);

  const totalCount = stickerSet?.stickers?.length;
  useInterval(
    () => {
      if (!totalCount) return;
      setCurrentStatusIndex((prevIndex) => (prevIndex + 1) % totalCount);
    },
    totalCount ? INTERVAL : undefined,
  );

  const renderPickerItem = useLastCallback(() => {
    return (
      <PeerChip
        withEmojiStatus
        className={styles.chatItem}
        itemClassName={styles.itemName}
        mockPeer={mockPeerWithStatus}
      />
    );
  });

  const confirmHandler = useLastCallback(() => {
    if (!modal?.bot?.id) return;
    closeEmojiStatusAccessModal();
    if (modal?.webAppKey) {
      if (isPremium) {
        sendWebAppEvent({
          webAppKey: modal.webAppKey,
          event: {
            eventType: 'emoji_status_access_requested',
            eventData: {
              status: 'allowed',
            },
          },
        });
        toggleUserEmojiStatusPermission({ botId: modal.bot.id, isEnabled: true, isBotAccessEmojiGranted: true });
      } else {
        openPremiumModal();
        sendWebAppEvent({
          webAppKey: modal.webAppKey,
          event: {
            eventType: 'emoji_status_access_requested',
            eventData: {
              status: 'cancelled',
            },
          },
        });
      }
    }
  });

  const onCloseHandler = useLastCallback(() => {
    if (!modal?.bot?.id) return;
    closeEmojiStatusAccessModal();
    if (modal?.webAppKey) {
      sendWebAppEvent({
        webAppKey: modal.webAppKey,
        event: {
          eventType: 'emoji_status_access_requested',
          eventData: {
            status: 'cancelled',
          },
        },
      });
    }
    if (isPremium) {
      toggleUserEmojiStatusPermission({ botId: modal.bot.id, isEnabled: false });
    }
  });

  const renderStatusText = useLastCallback(() => {
    if (!modal?.bot) return undefined;
    return lang('EmojiStatusAccessText', {
      name: getUserFullName(lang, modal?.bot),
    }, {
      withNodes: true,
      withMarkdown: true,
    });
  });

  return (
    <Modal
      className={buildClassName('confirm')}
      contentClassName={styles.content}
      isOpen={isOpen}
      onClose={onCloseHandler}
    >
      {renderPickerItem()}
      <div>
        {renderStatusText()}
        <div
          className="dialog-buttons mt-2"
          ref={containerRef}
        >
          <Button
            className="confirm-dialog-button"
            isText
            onClick={confirmHandler}
            color="primary"
          >
            {lang('BotAllowWriteConfirm')}
          </Button>
          <Button
            className="confirm-dialog-button"
            isText
            onClick={onCloseHandler}
          >
            {lang('Cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const currentUser = selectUser(global, global.currentUserId!);
    const isPremium = selectIsCurrentUserPremium(global);
    const stickerSet = global.defaultStatusIconsId ? selectStickerSet(global, global.defaultStatusIconsId) : undefined;
    const isAccountFrozen = selectIsCurrentUserFrozen(global);

    return {
      currentUser,
      stickerSet,
      isPremium,
      isAccountFrozen,
    };
  },
)(EmojiStatusAccessModal));
