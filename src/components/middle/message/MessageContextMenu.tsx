import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type {
  ApiAvailableReaction,
  ApiChat,
  ApiChatReactions,
  ApiMessage,
  ApiPeer,
  ApiReaction,
  ApiSponsoredMessage,
  ApiStickerSet,
  ApiThreadInfo,
  ApiUser,
} from '../../../api/types';
import type { IAnchorPosition } from '../../../types';

import { getUserFullName, isUserId } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import { disableScrolling, enableScrolling } from '../../../util/scrollLock';
import { REM } from '../../common/helpers/mediaDimensions';
import renderText from '../../common/helpers/renderText';
import { getMessageCopyOptions } from './helpers/copyOptions';

import useAppLayout from '../../../hooks/useAppLayout';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useMenuPosition from '../../../hooks/useMenuPosition';

import AvatarList from '../../common/AvatarList';
import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';
import MenuSeparator from '../../ui/MenuSeparator';
import Skeleton from '../../ui/placeholder/Skeleton';
import ReactionSelector from './ReactionSelector';

import './MessageContextMenu.scss';

type OwnProps = {
  isReactionPickerOpen?: boolean;
  availableReactions?: ApiAvailableReaction[];
  topReactions?: ApiReaction[];
  isOpen: boolean;
  anchor: IAnchorPosition;
  targetHref?: string;
  message: ApiMessage | ApiSponsoredMessage;
  canSendNow?: boolean;
  enabledReactions?: ApiChatReactions;
  maxUniqueReactions?: number;
  canReschedule?: boolean;
  canReply?: boolean;
  repliesThreadInfo?: ApiThreadInfo;
  canPin?: boolean;
  canUnpin?: boolean;
  canDelete?: boolean;
  canReport?: boolean;
  canShowReactionsCount?: boolean;
  canShowReactionList?: boolean;
  canBuyPremium?: boolean;
  canEdit?: boolean;
  canForward?: boolean;
  canFaveSticker?: boolean;
  canUnfaveSticker?: boolean;
  canCopy?: boolean;
  canCopyLink?: boolean;
  canSelect?: boolean;
  canTranslate?: boolean;
  canShowOriginal?: boolean;
  canSelectLanguage?: boolean;
  isPrivate?: boolean;
  isCurrentUserPremium?: boolean;
  canDownload?: boolean;
  canSaveGif?: boolean;
  canRevote?: boolean;
  canClosePoll?: boolean;
  isDownloading?: boolean;
  canShowSeenBy?: boolean;
  seenByRecentPeers?: ApiPeer[];
  noReplies?: boolean;
  hasCustomEmoji?: boolean;
  customEmojiSets?: ApiStickerSet[];
  canPlayAnimatedEmojis?: boolean;
  noTransition?: boolean;
  onReply?: NoneToVoidFunction;
  onOpenThread?: VoidFunction;
  onEdit?: NoneToVoidFunction;
  onPin?: NoneToVoidFunction;
  onUnpin?: NoneToVoidFunction;
  onForward?: NoneToVoidFunction;
  onDelete?: NoneToVoidFunction;
  onReport?: NoneToVoidFunction;
  onFaveSticker?: NoneToVoidFunction;
  onUnfaveSticker?: NoneToVoidFunction;
  onSelect?: NoneToVoidFunction;
  onSend?: NoneToVoidFunction;
  onReschedule?: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
  onCloseAnimationEnd?: NoneToVoidFunction;
  onCopyLink?: NoneToVoidFunction;
  onCopyMessages?: (messageIds: number[]) => void;
  onCopyNumber?: NoneToVoidFunction;
  onDownload?: NoneToVoidFunction;
  onSaveGif?: NoneToVoidFunction;
  onCancelVote?: NoneToVoidFunction;
  onClosePoll?: NoneToVoidFunction;
  onShowSeenBy?: NoneToVoidFunction;
  onShowReactors?: NoneToVoidFunction;
  onAboutAds?: NoneToVoidFunction;
  onSponsoredHide?: NoneToVoidFunction;
  onSponsorInfo?: NoneToVoidFunction;
  onTranslate?: NoneToVoidFunction;
  onShowOriginal?: NoneToVoidFunction;
  onSelectLanguage?: NoneToVoidFunction;
  onToggleReaction?: (reaction: ApiReaction) => void;
  onReactionPickerOpen?: (position: IAnchorPosition) => void;
};

const SCROLLBAR_WIDTH = 10;
const REACTION_BUBBLE_EXTRA_WIDTH = 32;
const REACTION_SELECTOR_WIDTH_REM = 19.25;
const ANIMATION_DURATION = 200;

const MessageContextMenu: FC<OwnProps> = ({
  isReactionPickerOpen,
  availableReactions,
  topReactions,
  isOpen,
  message,
  isPrivate,
  isCurrentUserPremium,
  enabledReactions,
  maxUniqueReactions,
  anchor,
  targetHref,
  canSendNow,
  canReschedule,
  canBuyPremium,
  canReply,
  canEdit,
  noReplies,
  canPin,
  canUnpin,
  canDelete,
  canReport,
  canForward,
  canFaveSticker,
  canUnfaveSticker,
  canCopy,
  canCopyLink,
  canSelect,
  canDownload,
  canSaveGif,
  canRevote,
  canClosePoll,
  canTranslate,
  canShowOriginal,
  canSelectLanguage,
  isDownloading,
  repliesThreadInfo,
  canShowSeenBy,
  canShowReactionsCount,
  canShowReactionList,
  seenByRecentPeers,
  hasCustomEmoji,
  customEmojiSets,
  canPlayAnimatedEmojis,
  noTransition,
  onReply,
  onOpenThread,
  onEdit,
  onPin,
  onUnpin,
  onForward,
  onDelete,
  onReport,
  onFaveSticker,
  onUnfaveSticker,
  onSelect,
  onSend,
  onReschedule,
  onClose,
  onCloseAnimationEnd,
  onCopyLink,
  onCopyNumber,
  onDownload,
  onSaveGif,
  onCancelVote,
  onClosePoll,
  onShowSeenBy,
  onShowReactors,
  onToggleReaction,
  onCopyMessages,
  onAboutAds,
  onSponsoredHide,
  onSponsorInfo,
  onReactionPickerOpen,
  onTranslate,
  onShowOriginal,
  onSelectLanguage,
}) => {
  const { showNotification, openStickerSet, openCustomEmojiSets } = getActions();
  // eslint-disable-next-line no-null/no-null
  const menuRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const scrollableRef = useRef<HTMLDivElement>(null);
  const lang = useLang();
  const noReactions = !isPrivate && !enabledReactions;
  const withReactions = canShowReactionList && !noReactions;
  const isSponsoredMessage = !('id' in message);
  const messageId = !isSponsoredMessage ? message.id : '';
  const seenByDates = !isSponsoredMessage ? message.seenByDates : undefined;

  const [areItemsHidden, hideItems] = useFlag();
  const [isReady, markIsReady, unmarkIsReady] = useFlag();
  const { isMobile, isDesktop } = useAppLayout();
  const seenByDatesCount = useMemo(() => (seenByDates ? Object.keys(seenByDates).length : 0), [seenByDates]);

  const handleAfterCopy = useLastCallback(() => {
    showNotification({
      message: lang('Share.Link.Copied'),
    });
    onClose();
  });

  useEffect(() => {
    if (isOpen && areItemsHidden && !isReactionPickerOpen) {
      onClose();
    }
  }, [onClose, isOpen, isReactionPickerOpen, areItemsHidden]);

  const handleOpenCustomEmojiSets = useLastCallback(() => {
    if (!customEmojiSets) return;
    if (customEmojiSets.length === 1) {
      openStickerSet({
        stickerSetInfo: {
          shortName: customEmojiSets[0].shortName,
        },
      });
    } else {
      openCustomEmojiSets({
        setIds: customEmojiSets.map((set) => set.id),
      });
    }
    onClose();
  });

  const copyOptions = isSponsoredMessage
    ? []
    : getMessageCopyOptions(
      message,
      targetHref,
      canCopy,
      handleAfterCopy,
      canCopyLink ? onCopyLink : undefined,
      onCopyMessages,
      onCopyNumber,
    );

  const getTriggerElement = useLastCallback(() => {
    return isSponsoredMessage
      ? document.querySelector('.Transition_slide-active > .MessageList .SponsoredMessage')
      : document.querySelector(`.Transition_slide-active > .MessageList div[data-message-id="${messageId}"]`);
  });

  const getRootElement = useLastCallback(() => document.querySelector('.Transition_slide-active > .MessageList'));

  const getMenuElement = useLastCallback(() => document.querySelector('.MessageContextMenu .bubble'));

  const getLayout = useLastCallback(() => {
    const extraHeightAudioPlayer = (isMobile
      && (document.querySelector<HTMLElement>('.AudioPlayer-content'))?.offsetHeight) || 0;
    const pinnedElement = document.querySelector<HTMLElement>('.HeaderPinnedMessageWrapper');
    const extraHeightPinned = (((isMobile && !extraHeightAudioPlayer)
        || (!isMobile && pinnedElement?.classList.contains('full-width')))
      && pinnedElement?.offsetHeight) || 0;

    return {
      extraPaddingX: SCROLLBAR_WIDTH,
      extraTopPadding: (document.querySelector<HTMLElement>('.MiddleHeader')!).offsetHeight,
      marginSides: withReactions ? REACTION_BUBBLE_EXTRA_WIDTH : undefined,
      extraMarginTop: extraHeightPinned + extraHeightAudioPlayer,
      shouldAvoidNegativePosition: !isDesktop,
      menuElMinWidth: withReactions && isMobile ? REACTION_SELECTOR_WIDTH_REM * REM : undefined,
    };
  });

  useEffect(() => {
    if (!isOpen) {
      unmarkIsReady();
      return;
    }

    setTimeout(() => {
      markIsReady();
    }, ANIMATION_DURATION);
  }, [isOpen, markIsReady, unmarkIsReady]);

  const {
    positionX, positionY, transformOriginX, transformOriginY, style, menuStyle, withScroll,
  } = useMenuPosition(anchor, getTriggerElement, getRootElement, getMenuElement, getLayout);

  useEffect(() => {
    disableScrolling(withScroll ? scrollableRef.current : undefined, '.ReactionPicker');

    return enableScrolling;
  }, [withScroll]);

  const handleOpenMessageReactionPicker = useLastCallback((position: IAnchorPosition) => {
    onReactionPickerOpen!(position);
    hideItems();
  });

  return (
    <Menu
      ref={menuRef}
      isOpen={isOpen}
      transformOriginX={transformOriginX}
      transformOriginY={transformOriginY}
      positionX={positionX}
      positionY={positionY}
      style={style}
      bubbleStyle={menuStyle}
      className={buildClassName(
        'MessageContextMenu', 'fluid', withReactions && 'with-reactions',
      )}
      shouldSkipTransition={noTransition}
      onClose={onClose}
      onCloseAnimationEnd={onCloseAnimationEnd}
    >
      {withReactions && (
        <ReactionSelector
          enabledReactions={enabledReactions}
          topReactions={topReactions}
          allAvailableReactions={availableReactions}
          currentReactions={!isSponsoredMessage ? message.reactions?.results : undefined}
          maxUniqueReactions={maxUniqueReactions}
          onToggleReaction={onToggleReaction!}
          isPrivate={isPrivate}
          isReady={isReady}
          canBuyPremium={canBuyPremium}
          isCurrentUserPremium={isCurrentUserPremium}
          canPlayAnimatedEmojis={canPlayAnimatedEmojis}
          onShowMore={handleOpenMessageReactionPicker}
          className={buildClassName(areItemsHidden && 'ReactionSelector-hidden')}
        />
      )}

      <div
        className={buildClassName(
          'MessageContextMenu_items scrollable-content custom-scroll',
          areItemsHidden && 'MessageContextMenu_items-hidden',
        )}
        style={menuStyle}
        ref={scrollableRef}
      >
        {canSendNow && <MenuItem icon="send-outline" onClick={onSend}>{lang('MessageScheduleSend')}</MenuItem>}
        {canReschedule && (
          <MenuItem icon="schedule" onClick={onReschedule}>{lang('MessageScheduleEditTime')}</MenuItem>
        )}
        {canReply && <MenuItem icon="reply" onClick={onReply}>{lang('Reply')}</MenuItem>}
        {!noReplies && Boolean(repliesThreadInfo?.messagesCount) && (
          <MenuItem icon="replies" onClick={onOpenThread}>
            {lang('Conversation.ContextViewReplies', repliesThreadInfo!.messagesCount, 'i')}
          </MenuItem>
        )}
        {canEdit && <MenuItem icon="edit" onClick={onEdit}>{lang('Edit')}</MenuItem>}
        {canFaveSticker && (
          <MenuItem icon="favorite" onClick={onFaveSticker}>{lang('AddToFavorites')}</MenuItem>
        )}
        {canUnfaveSticker && (
          <MenuItem icon="favorite" onClick={onUnfaveSticker}>{lang('Stickers.RemoveFromFavorites')}</MenuItem>
        )}
        {canTranslate && <MenuItem icon="language" onClick={onTranslate}>{lang('TranslateMessage')}</MenuItem>}
        {canShowOriginal && <MenuItem icon="language" onClick={onShowOriginal}>{lang('ShowOriginalButton')}</MenuItem>}
        {canSelectLanguage && (
          <MenuItem icon="web" onClick={onSelectLanguage}>{lang('lng_settings_change_lang')}</MenuItem>
        )}
        {copyOptions.map((option) => (
          <MenuItem key={option.label} icon={option.icon} onClick={option.handler}>{lang(option.label)}</MenuItem>
        ))}
        {canPin && <MenuItem icon="pin" onClick={onPin}>{lang('DialogPin')}</MenuItem>}
        {canUnpin && <MenuItem icon="unpin" onClick={onUnpin}>{lang('DialogUnpin')}</MenuItem>}
        {canSaveGif && <MenuItem icon="gifs" onClick={onSaveGif}>{lang('lng_context_save_gif')}</MenuItem>}
        {canRevote && <MenuItem icon="revote" onClick={onCancelVote}>{lang('lng_polls_retract')}</MenuItem>}
        {canClosePoll && <MenuItem icon="stop" onClick={onClosePoll}>{lang('lng_polls_stop')}</MenuItem>}
        {canDownload && (
          <MenuItem icon="download" onClick={onDownload}>
            {isDownloading ? lang('lng_context_cancel_download') : lang('lng_media_download')}
          </MenuItem>
        )}
        {canForward && <MenuItem icon="forward" onClick={onForward}>{lang('Forward')}</MenuItem>}
        {canSelect && <MenuItem icon="select" onClick={onSelect}>{lang('Common.Select')}</MenuItem>}
        {canReport && <MenuItem icon="flag" onClick={onReport}>{lang('lng_context_report_msg')}</MenuItem>}
        {(canShowSeenBy || canShowReactionsCount) && !isSponsoredMessage && (
          <MenuItem
            icon={canShowReactionsCount ? 'heart-outline' : 'group'}
            onClick={canShowReactionsCount ? onShowReactors : onShowSeenBy}
            disabled={!canShowReactionsCount && !seenByDatesCount}
          >
            <span className="MessageContextMenu--seen-by-label-wrapper">
              <span className="MessageContextMenu--seen-by-label" dir={lang.isRtl ? 'rtl' : undefined}>
                {canShowReactionsCount && message.reactors?.count ? (
                  canShowSeenBy && seenByDatesCount
                    ? lang(
                      'Chat.OutgoingContextMixedReactionCount',
                      [message.reactors.count, seenByDatesCount],
                    )
                    : lang('Chat.ContextReactionCount', message.reactors.count, 'i')
                ) : (
                  seenByDatesCount === 1 && seenByRecentPeers
                    ? renderText(
                      isUserId(seenByRecentPeers[0].id)
                        ? getUserFullName(seenByRecentPeers[0] as ApiUser)!
                        : (seenByRecentPeers[0] as ApiChat).title,
                    ) : (
                      seenByDatesCount
                        ? lang('Conversation.ContextMenuSeen', seenByDatesCount, 'i')
                        : lang('Conversation.ContextMenuNoViews')
                    )
                )}
              </span>
            </span>
            <AvatarList className="avatars" size="micro" peers={seenByRecentPeers} />
          </MenuItem>
        )}
        {canDelete && <MenuItem destructive icon="delete" onClick={onDelete}>{lang('Delete')}</MenuItem>}
        {hasCustomEmoji && (
          <>
            <MenuSeparator />
            {!customEmojiSets && (
              <>
                <Skeleton inline className="menu-loading-row" />
                <Skeleton inline className="menu-loading-row" />
              </>
            )}
            {customEmojiSets && customEmojiSets.length === 1 && (
              <MenuItem withWrap onClick={handleOpenCustomEmojiSets} className="menu-custom-emoji-sets">
                {renderText(lang('MessageContainsEmojiPack', customEmojiSets[0].title), ['simple_markdown', 'emoji'])}
              </MenuItem>
            )}
            {customEmojiSets && customEmojiSets.length > 1 && (
              <MenuItem withWrap onClick={handleOpenCustomEmojiSets} className="menu-custom-emoji-sets">
                {renderText(lang('MessageContainsEmojiPacks', customEmojiSets.length), ['simple_markdown'])}
              </MenuItem>
            )}
          </>
        )}
        {isSponsoredMessage && message.sponsorInfo && (
          <MenuItem icon="channel" onClick={onSponsorInfo}>{lang('SponsoredMessageSponsor')}</MenuItem>
        )}
        {isSponsoredMessage && <MenuItem icon="help" onClick={onAboutAds}>{lang('SponsoredMessageInfo')}</MenuItem>}
        {isSponsoredMessage && onSponsoredHide && (
          <MenuItem icon="stop" onClick={onSponsoredHide}>{lang('HideAd')}</MenuItem>
        )}
      </div>
    </Menu>
  );
};

export default memo(MessageContextMenu);
