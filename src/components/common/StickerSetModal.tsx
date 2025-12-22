import type { FC } from '../../lib/teact/teact';
import {
  memo, useCallback, useEffect, useMemo, useRef,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiSticker, ApiStickerSet } from '../../api/types';
import type { MessageList } from '../../types';

import { EMOJI_SIZE_MODAL, STICKER_SIZE_MODAL, TME_LINK_PREFIX } from '../../config';
import { getAllowedAttachmentOptions, getCanPostInChat } from '../../global/helpers';
import {
  selectBot,
  selectCanScheduleUntilOnline,
  selectChat,
  selectChatFullInfo,
  selectCurrentMessageList,
  selectIsChatWithSelf,
  selectIsCurrentUserPremium,
  selectPeerPaidMessagesStars,
  selectShouldSchedule,
  selectStickerSet,
  selectThreadInfo,
  selectTopic,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { copyTextToClipboard } from '../../util/clipboard';
import renderText from './helpers/renderText';

import useAppLayout from '../../hooks/useAppLayout';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import useOldLang from '../../hooks/useOldLang';
import usePreviousDeprecated from '../../hooks/usePreviousDeprecated';
import useSchedule from '../../hooks/useSchedule';
import useScrolledState from '../../hooks/useScrolledState';

import Button from '../ui/Button';
import DropdownMenu from '../ui/DropdownMenu';
import Loading from '../ui/Loading';
import MenuItem from '../ui/MenuItem';
import Modal from '../ui/Modal';
import StickerButton from './StickerButton';

import './StickerSetModal.scss';

export type OwnProps = {
  isOpen: boolean;
  fromSticker?: ApiSticker;
  stickerSetShortName?: string;
  onClose: () => void;
};

type StateProps = {
  currentMessageList?: MessageList;
  canSendStickers?: boolean;
  stickerSet?: ApiStickerSet;
  canScheduleUntilOnline?: boolean;
  shouldSchedule?: boolean;
  isSavedMessages?: boolean;
  isCurrentUserPremium?: boolean;
  shouldUpdateStickerSetOrder?: boolean;
};

const INTERSECTION_THROTTLE = 200;

const StickerSetModal: FC<OwnProps & StateProps> = ({
  isOpen,
  fromSticker,
  stickerSetShortName,
  stickerSet,
  canSendStickers,
  canScheduleUntilOnline,
  shouldSchedule,
  isSavedMessages,
  isCurrentUserPremium,
  shouldUpdateStickerSetOrder,
  currentMessageList,
  onClose,
}) => {
  const {
    loadStickers,
    toggleStickerSet,
    sendMessage,
    showNotification,
  } = getActions();

  const containerRef = useRef<HTMLDivElement>();
  const sharedCanvasRef = useRef<HTMLCanvasElement>();

  const lang = useOldLang();

  const { isMobile } = useAppLayout();

  const prevStickerSet = usePreviousDeprecated(stickerSet);
  const renderingStickerSet = stickerSet || prevStickerSet;

  const isAdded = Boolean(!renderingStickerSet?.isArchived && renderingStickerSet?.installedDate);
  const isEmoji = renderingStickerSet?.isEmoji;

  const [requestCalendar, calendar] = useSchedule(canScheduleUntilOnline);
  const {
    handleScroll: handleContentScroll,
    isAtBeginning: shouldHideTopBorder,
  } = useScrolledState();

  const {
    observe: observeIntersection,
  } = useIntersectionObserver({ rootRef: containerRef, throttleMs: INTERSECTION_THROTTLE, isDisabled: !isOpen });

  useEffect(() => {
    if (isOpen && !renderingStickerSet?.stickers) {
      loadStickers({
        stickerSetInfo: fromSticker ? fromSticker.stickerSetInfo : { shortName: stickerSetShortName! },
      });
    }
  }, [isOpen, fromSticker, loadStickers, stickerSetShortName, renderingStickerSet]);

  const handleSelect = useCallback((sticker: ApiSticker, isSilent?: boolean, isScheduleRequested?: boolean) => {
    if (!currentMessageList) {
      return;
    }
    sticker = {
      ...sticker,
      isPreloadedGlobally: true,
    };

    if (shouldSchedule || isScheduleRequested) {
      requestCalendar((scheduledAt, scheduleRepeatPeriod) => {
        sendMessage({
          messageList: currentMessageList, sticker, isSilent, scheduledAt, scheduleRepeatPeriod,
        });
        onClose();
      });
    } else {
      sendMessage({
        messageList: currentMessageList,
        sticker,
        isSilent,
        shouldUpdateStickerSetOrder: shouldUpdateStickerSetOrder && isAdded,
      });
      onClose();
    }
  }, [currentMessageList, shouldSchedule, requestCalendar, onClose, shouldUpdateStickerSetOrder, isAdded]);

  const handleButtonClick = useCallback(() => {
    if (renderingStickerSet) {
      toggleStickerSet({ stickerSetId: renderingStickerSet.id });
      onClose();
    }
  }, [onClose, renderingStickerSet, toggleStickerSet]);

  const handleCopyLink = useCallback(() => {
    if (!renderingStickerSet) return;
    const { shortName } = renderingStickerSet;
    const suffix = isEmoji ? 'addemoji' : 'addstickers';
    const url = `${TME_LINK_PREFIX}${suffix}/${shortName}`;
    copyTextToClipboard(url);
    showNotification({
      message: lang('LinkCopied'),
    });
  }, [isEmoji, lang, renderingStickerSet, showNotification]);

  const renderButtonText = () => {
    if (!renderingStickerSet) return lang('Loading');

    const suffix = isEmoji ? 'Emoji' : 'Sticker';

    return lang(
      isAdded ? `StickerPack.Remove${suffix}Count` : `StickerPack.Add${suffix}Count`,
      renderingStickerSet.count,
      'i',
    );
  };

  const MoreMenuButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isOpen: isMenuOpen }) => (
      <Button
        round
        ripple={!isMobile}
        size="smaller"
        color="translucent"
        className={isMenuOpen ? 'active' : ''}
        onClick={onTrigger}
        ariaLabel="More actions"
        iconName="more"
      />
    );
  }, [isMobile]);

  function renderHeader() {
    const fullClassName = buildClassName('modal-header', !shouldHideTopBorder && 'with-top-border');

    return (
      <div className={fullClassName} dir={lang.isRtl ? 'rtl' : undefined}>
        <Button
          round
          color="translucent"
          size="tiny"
          ariaLabel={lang('Close')}
          onClick={onClose}
          iconName="close"
        />
        <div className="modal-title">
          {renderingStickerSet ? renderText(renderingStickerSet.title, ['emoji', 'links']) : lang('AccDescrStickerSet')}
        </div>
        <DropdownMenu
          className="stickers-more-menu with-menu-transitions"
          trigger={MoreMenuButton}
          positionX="right"
        >
          <MenuItem icon="copy" onClick={handleCopyLink}>{lang('StickersCopy')}</MenuItem>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <Modal
      className={buildClassName('StickerSetModal', isEmoji && 'custom-emoji')}
      isOpen={isOpen}
      onClose={onClose}
      header={renderHeader()}
    >
      {renderingStickerSet?.stickers ? (
        <>
          <div ref={containerRef} className="stickers custom-scroll" onScroll={handleContentScroll}>
            <div className="shared-canvas-container stickers-grid">
              <canvas ref={sharedCanvasRef} className="shared-canvas" />
              {renderingStickerSet.stickers.map((sticker) => (
                <StickerButton
                  sticker={sticker}
                  size={isEmoji ? EMOJI_SIZE_MODAL : STICKER_SIZE_MODAL}
                  observeIntersection={observeIntersection}
                  onClick={canSendStickers && !isEmoji ? handleSelect : undefined}
                  clickArg={sticker}
                  isSavedMessages={isSavedMessages}
                  isCurrentUserPremium={isCurrentUserPremium}
                  sharedCanvasRef={sharedCanvasRef}
                />
              ))}
            </div>
          </div>
          <div className="button-wrapper">
            <Button
              fluid
              color={isAdded ? 'danger' : 'primary'}
              onClick={handleButtonClick}
            >
              {renderButtonText()}
            </Button>
          </div>
        </>
      ) : (
        <Loading />
      )}
      {calendar}
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { fromSticker, stickerSetShortName }): Complete<StateProps> => {
    const currentMessageList = selectCurrentMessageList(global);
    const { chatId, threadId } = currentMessageList || {};
    const chat = chatId && selectChat(global, chatId);
    const chatFullInfo = chatId ? selectChatFullInfo(global, chatId) : undefined;
    const chatBot = chatId && selectBot(global, chatId);
    const isSavedMessages = chatId ? selectIsChatWithSelf(global, chatId) : undefined;

    const sendOptions = chat
      ? getAllowedAttachmentOptions(chat, chatFullInfo, Boolean(chatBot), isSavedMessages)
      : undefined;
    const threadInfo = chatId && threadId ? selectThreadInfo(global, chatId, threadId) : undefined;
    const isMessageThread = Boolean(!threadInfo?.isCommentsInfo && threadInfo?.fromChannelId);
    const topic = chatId && threadId ? selectTopic(global, chatId, threadId) : undefined;
    const canSendStickers = Boolean(
      chat && threadId && getCanPostInChat(chat, topic, isMessageThread, chatFullInfo)
      && sendOptions?.canSendStickers,
    );

    const stickerSetInfo = fromSticker ? fromSticker.stickerSetInfo
      : stickerSetShortName ? { shortName: stickerSetShortName } : undefined;

    const stickerSet = stickerSetInfo ? selectStickerSet(global, stickerSetInfo) : undefined;
    const paidMessagesStars = chatId ? selectPeerPaidMessagesStars(global, chatId) : undefined;

    return {
      canScheduleUntilOnline: Boolean(chatId) && selectCanScheduleUntilOnline(global, chatId),
      canSendStickers,
      isSavedMessages,
      shouldSchedule: !paidMessagesStars && selectShouldSchedule(global),
      stickerSet,
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
      shouldUpdateStickerSetOrder: global.settings.byKey.shouldUpdateStickerSetOrder,
      currentMessageList,
    };
  },
)(StickerSetModal));
