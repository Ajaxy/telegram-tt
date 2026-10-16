import {
  memo, useEffect, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type {
  ApiAvailableReaction,
  ApiChat,
  ApiChatReactions,
  ApiMessage,
  ApiMessagePoll,
  ApiPeer,
  ApiReaction,
  ApiStickerSet,
  ApiThreadInfo,
  ApiTypeStory,
  ApiUser,
  ApiWebPage,
} from '../../../api/types';
import type {
  IAnchorPosition, MessageListType, ThreadId, TranslationTone,
} from '../../../types';
import type { ClipboardTextFormat, MessageCopyRequest } from '../../../types/messageCopy';

import {
  getUserFullName,
  groupStatefulContent,
} from '../../../global/helpers';
import { getPeerTitle } from '../../../global/helpers/peers';
import buildClassName from '../../../util/buildClassName';
import { isUserId } from '../../../util/entities/ids';
import { disableScrolling } from '../../../util/scrollLock';
import { REM } from '../../common/helpers/mediaDimensions';
import renderText from '../../common/helpers/renderText';
import { getMessageCopyOptions } from './helpers/copyOptions';
import { getPollCountryRestrictionMessage, getPollSubscriberRestrictionMessage } from './poll/helpers';

import useAppLayout from '../../../hooks/useAppLayout';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import AvatarList from '../../common/AvatarList';
import Icon from '../../common/icons/Icon';
import Menu from '../../ui/Menu';
import MenuItem, { MenuItemSubtitle, MenuItemTitle } from '../../ui/MenuItem';
import MenuSeparator from '../../ui/MenuSeparator';
import NestedMenuItem from '../../ui/NestedMenuItem';
import Skeleton from '../../ui/placeholder/Skeleton';
import DeleteMenuItem from './DeleteMenuItem';
import LastEditTimeMenuItem from './LastEditTimeMenuItem';
import ReactionSelector from './reactions/ReactionSelector';
import ReadTimeMenuItem from './ReadTimeMenuItem';

import './MessageContextMenu.scss';

type OwnProps = {
  isReactionPickerOpen?: boolean;
  availableReactions?: ApiAvailableReaction[];
  topReactions?: ApiReaction[];
  defaultTagReactions?: ApiReaction[];
  isOpen: boolean;
  anchor: IAnchorPosition;
  targetHref?: string;
  isAltKeyPressed?: boolean;
  message: ApiMessage;
  threadId: ThreadId;
  messageListType: MessageListType;
  chat?: ApiChat;
  poll?: ApiMessagePoll;
  webPage?: ApiWebPage;
  story?: ApiTypeStory;
  canSendNow?: boolean;
  enabledReactions?: ApiChatReactions;
  isWithPaidReaction?: boolean;
  reactionsLimit?: number;
  canReschedule?: boolean;
  canReply?: boolean;
  canQuote?: boolean;
  repliesThreadInfo?: ApiThreadInfo;
  canPin?: boolean;
  canUnpin?: boolean;
  canDelete?: boolean;
  canReport?: boolean;
  canShowReactionsCount?: boolean;
  canShowReactionList?: boolean;
  canBuyPremium?: boolean;
  canEdit?: boolean;
  canAppendTodoList?: boolean;
  canForward?: boolean;
  canFaveSticker?: boolean;
  canUnfaveSticker?: boolean;
  canCopy?: boolean;
  canCopyLink?: boolean;
  canSelect?: boolean;
  canTranslate?: boolean;
  canShowOriginal?: boolean;
  canSelectLanguage?: boolean;
  currentTranslationTone?: TranslationTone;
  isPrivate?: boolean;
  isCurrentUserPremium?: boolean;
  canDownload?: boolean;
  canSaveGif?: boolean;
  canManageMusicInProfile?: boolean;
  isMusicProfileStatusLoaded?: boolean;
  isMusicProfileActionLoading?: boolean;
  isMusicSaved?: boolean;
  canRevote?: boolean;
  canClosePoll?: boolean;
  isDownloading?: boolean;
  canShowSeenBy?: boolean;
  seenByRecentPeers?: ApiPeer[];
  noReplies?: boolean;
  hasCustomEmoji?: boolean;
  customEmojiSets?: ApiStickerSet[];
  canPlayAnimatedEmojis?: boolean;
  isInSavedMessages?: boolean;
  shouldRenderShowWhen?: boolean;
  canLoadReadDate?: boolean;
  onReply?: NoneToVoidFunction;
  onOpenThread?: VoidFunction;
  onEdit?: NoneToVoidFunction;
  onAppendTodoList?: NoneToVoidFunction;
  onPin?: NoneToVoidFunction;
  onUnpin?: NoneToVoidFunction;
  onForward?: NoneToVoidFunction;
  onDelete?: NoneToVoidFunction;
  onFaveSticker?: NoneToVoidFunction;
  onReport?: NoneToVoidFunction;
  onUnfaveSticker?: NoneToVoidFunction;
  onSelect?: NoneToVoidFunction;
  onSend?: NoneToVoidFunction;
  onReschedule?: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
  onCloseAnimationEnd?: NoneToVoidFunction;
  onCopyLink?: NoneToVoidFunction;
  onCopyMessages?: (request: MessageCopyRequest, textFormat?: ClipboardTextFormat) => void;
  onCopyNumber?: NoneToVoidFunction;
  onDownload?: NoneToVoidFunction;
  onSaveGif?: NoneToVoidFunction;
  onToggleMusicInProfile?: NoneToVoidFunction;
  onCancelVote?: NoneToVoidFunction;
  onClosePoll?: NoneToVoidFunction;
  onShowSeenBy?: NoneToVoidFunction;
  onShowReactors?: NoneToVoidFunction;
  onTranslate?: NoneToVoidFunction;
  onTranslateWithTone?: (tone: TranslationTone) => void;
  onShowOriginal?: NoneToVoidFunction;
  onSelectLanguage?: NoneToVoidFunction;
  onToggleReaction?: (reaction: ApiReaction) => void;
  onSendPaidReaction?: NoneToVoidFunction;
  onShowPaidReactionModal?: NoneToVoidFunction;
  onReactionPickerOpen?: (position: IAnchorPosition) => void;
  userFullName?: string;
  canGift?: boolean;
  canSendGram?: boolean;
  noForwardsNotice?: string;
};

const SCROLLBAR_WIDTH = 10;
const REACTION_SELECTOR_WIDTH_REM = 19.25;
const ANIMATION_DURATION = 200;

const MessageContextMenu = ({
  isReactionPickerOpen,
  availableReactions,
  topReactions,
  defaultTagReactions,
  isOpen,
  message,
  threadId,
  messageListType,
  chat,
  poll,
  webPage,
  story,
  isPrivate,
  isCurrentUserPremium,
  enabledReactions,
  isWithPaidReaction,
  reactionsLimit,
  anchor,
  targetHref,
  isAltKeyPressed,
  canSendNow,
  canReschedule,
  canBuyPremium,
  canReply,
  canQuote,
  canEdit,
  canAppendTodoList,
  noReplies,
  canPin,
  canUnpin,
  canDelete,
  canForward,
  canReport,
  canFaveSticker,
  canUnfaveSticker,
  canCopy,
  canCopyLink,
  canSelect,
  canDownload,
  canSaveGif,
  canManageMusicInProfile,
  isMusicProfileStatusLoaded,
  isMusicProfileActionLoading,
  isMusicSaved,
  canRevote,
  canClosePoll,
  canTranslate,
  canShowOriginal,
  canSelectLanguage,
  currentTranslationTone,
  isDownloading,
  repliesThreadInfo,
  canShowSeenBy,
  canShowReactionsCount,
  canShowReactionList,
  seenByRecentPeers,
  hasCustomEmoji,
  customEmojiSets,
  canPlayAnimatedEmojis,
  isInSavedMessages,
  shouldRenderShowWhen,
  canLoadReadDate,
  onReply,
  onOpenThread,
  onEdit,
  onAppendTodoList,
  onPin,
  onUnpin,
  onForward,
  onDelete,
  onFaveSticker,
  onReport,
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
  onToggleMusicInProfile,
  onCancelVote,
  onClosePoll,
  onShowSeenBy,
  onShowReactors,
  onToggleReaction,
  onSendPaidReaction,
  onShowPaidReactionModal,
  onCopyMessages,
  onReactionPickerOpen,
  onTranslate,
  onTranslateWithTone,
  onShowOriginal,
  onSelectLanguage,
  userFullName,
  canGift,
  canSendGram,
  noForwardsNotice,
}: OwnProps) => {
  const {
    showNotification, openStickerSet, openCustomEmojiSets, loadStickers, openGiftModal,
    openWalletTransferLink,
  } = getActions();
  const menuRef = useRef<HTMLDivElement>();
  const scrollableRef = useRef<HTMLDivElement>();

  const lang = useLang();
  const noReactions = !isPrivate && !enabledReactions;
  const areReactionsPossible = message.areReactionsPossible;
  const withReactions = (canShowReactionList && !noReactions) || areReactionsPossible;
  const isEdited = ('isEdited' in message) && message.isEdited;
  const seenByDates = message.seenByDates;
  const isPremiumGift = message.content.action?.type === 'giftPremium';
  const isGiftCode = message.content.action?.type === 'giftCode';
  const isStarGift = message.content.action?.type === 'starGift';
  const isStarGiftUnique = message.content.action?.type === 'starGiftUnique';
  const shouldShowGiftButton = isUserId(message.chatId)
    && canGift && (isPremiumGift || isGiftCode || isStarGift || isStarGiftUnique);
  const pollCountryRestrictionMessage = useMemo(
    () => getPollCountryRestrictionMessage(lang, poll?.summary.allowedCountryCodes),
    [lang, poll?.summary.allowedCountryCodes],
  );
  const pollSubscriberRestrictionChannel = chat && getPeerTitle(lang, chat);
  const pollSubscriberRestrictionMessage = useMemo(
    () => getPollSubscriberRestrictionMessage(
      pollSubscriberRestrictionChannel,
      poll?.summary.isRestrictedToSubscribers,
    ),
    [poll?.summary.isRestrictedToSubscribers, pollSubscriberRestrictionChannel],
  );
  const hasPollRestrictionMessage = Boolean(pollSubscriberRestrictionMessage) || Boolean(pollCountryRestrictionMessage);
  const autoDeleteAt = message.ttlPeriod ? message.date + message.ttlPeriod : undefined;
  const shouldRenderInfoSection = Boolean(
    canLoadReadDate || shouldRenderShowWhen || isEdited || noForwardsNotice || hasPollRestrictionMessage,
  );

  const [isReady, markIsReady, unmarkIsReady] = useFlag();
  const { isMobile } = useAppLayout();
  const seenByDatesCount = useMemo(() => (seenByDates ? Object.keys(seenByDates).length : 0), [seenByDates]);
  const totalSeenCount = useMemo(() => {
    const ids = new Set(seenByDates ? Object.keys(seenByDates) : []);
    message.reactors?.reactions?.forEach(({ peerId }) => ids.add(peerId));
    return ids.size;
  }, [seenByDates, message.reactors?.reactions]);

  const handleAfterCopy = useLastCallback(() => {
    showNotification({
      message: {
        key: 'ShareLinkCopied',
        options: { withNodes: true, withMarkdown: true, renderTextFilters: ['br', 'links'] },
      },
    });
    onClose();
  });

  const handleGiftClick = useLastCallback(() => {
    openGiftModal({ forUserId: message.chatId });
    onClose();
  });

  const handleSendGramClick = useLastCallback(() => {
    openWalletTransferLink({ userId: message.chatId, shouldCloseAfterSend: true });
    onClose();
  });

  useEffect(() => {
    if (customEmojiSets?.length) {
      customEmojiSets.map((customEmojiSet) => {
        return loadStickers({
          stickerSetInfo: {
            id: customEmojiSet.id,
            accessHash: customEmojiSet.accessHash,
          },
        });
      });
    }
  }, [customEmojiSets, openCustomEmojiSets]);

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

  const copyOptions = getMessageCopyOptions(
    message,
    groupStatefulContent({ poll, webPage, story }),
    threadId,
    messageListType,
    targetHref,
    canCopy,
    handleAfterCopy,
    canCopyLink ? onCopyLink : undefined,
    onCopyMessages,
    onCopyNumber,
  );

  const getTriggerElement = useLastCallback(() => {
    return document.querySelector(`.Transition_slide-active > .MessageList`);
  });

  const getRootElement = useLastCallback(() => document.body);

  const getMenuElement = useLastCallback(() => document.querySelector('.MessageContextMenu .bubble'));

  const getLayout = useLastCallback(() => {
    return {
      extraPaddingX: SCROLLBAR_WIDTH,
      extraTopPadding: (document.querySelector<HTMLElement>('.MiddleHeader')!).offsetHeight,
      shouldAvoidNegativePosition: true,
      menuElMinWidth: withReactions && isMobile ? REACTION_SELECTOR_WIDTH_REM * REM : undefined,
      withPortal: true,
    };
  });

  useEffect(() => {
    if (!isOpen) {
      unmarkIsReady();
      return;
    }

    const timeout = setTimeout(() => {
      markIsReady();
    }, ANIMATION_DURATION);

    return () => {
      clearTimeout(timeout);
    };
  }, [isOpen]);

  useEffect(() => {
    return disableScrolling(scrollableRef.current, '.ReactionPicker');
  }, [isOpen]);

  const handleOpenMessageReactionPicker = useLastCallback((position: IAnchorPosition) => {
    onReactionPickerOpen!(position);
    onClose();
  });

  return (
    <Menu
      ref={menuRef}
      isOpen={isOpen}
      anchor={anchor}
      getTriggerElement={getTriggerElement}
      getRootElement={getRootElement}
      getMenuElement={getMenuElement}
      getLayout={getLayout}
      withMaxHeight
      className={buildClassName(
        'MessageContextMenu', 'fluid', withReactions && 'with-reactions',
      )}
      withPortal
      onClose={onClose}
      onCloseAnimationEnd={onCloseAnimationEnd}
    >
      {withReactions && (
        <ReactionSelector
          enabledReactions={enabledReactions}
          topReactions={topReactions}
          allAvailableReactions={availableReactions}
          defaultTagReactions={defaultTagReactions}
          currentReactions={message.reactions?.results}
          reactionsLimit={reactionsLimit}
          onToggleReaction={onToggleReaction!}
          onSendPaidReaction={onSendPaidReaction}
          onShowPaidReactionModal={onShowPaidReactionModal}
          isWithPaidReaction={isWithPaidReaction}
          isPrivate={isPrivate}
          isReady={isReady}
          canBuyPremium={canBuyPremium}
          isCurrentUserPremium={isCurrentUserPremium}
          isInSavedMessages={isInSavedMessages}
          canPlayAnimatedEmojis={canPlayAnimatedEmojis}
          onShowMore={handleOpenMessageReactionPicker}
          onClose={onClose}
        />
      )}

      <div
        ref={scrollableRef}
        className={buildClassName(
          'MessageContextMenu_items scrollable-content custom-scroll',
        )}
        dir={lang.isRtl ? 'rtl' : undefined}
      >
        {shouldShowGiftButton
          && (
            <MenuItem icon="gift" onClick={handleGiftClick}>
              {message?.isOutgoing ? lang('SendAnotherGift')
                : lang('ConversationContextMenuSendGiftTo', { user: userFullName })}
            </MenuItem>
          )}
        {canSendGram && (
          <MenuItem icon="gram-outline" onClick={handleSendGramClick}>
            {lang('WalletSendMoney')}
          </MenuItem>
        )}
        {canSendNow && <MenuItem icon="send-outline" onClick={onSend}>{lang('MessageScheduleSend')}</MenuItem>}
        {canReschedule && (
          <MenuItem icon="schedule" onClick={onReschedule}>{lang('MessageScheduleEditTime')}</MenuItem>
        )}
        {canReply && (
          <MenuItem icon="reply" onClick={onReply}>
            {lang(canQuote ? 'ContextQuoteAndReply' : 'Reply')}
          </MenuItem>
        )}
        {!noReplies && Boolean(repliesThreadInfo?.messagesCount) && (
          <MenuItem icon="replies" onClick={onOpenThread}>
            {lang('ConversationContextViewReplies', {
              count: lang.number(repliesThreadInfo.messagesCount),
            }, { pluralValue: repliesThreadInfo.messagesCount })}
          </MenuItem>
        )}
        {canEdit && <MenuItem icon="edit" onClick={onEdit}>{lang('Edit')}</MenuItem>}
        {canAppendTodoList && (
          <MenuItem icon="add" onClick={onAppendTodoList}>
            {lang('MenuButtonAppendTodoList')}
          </MenuItem>
        )}
        {canFaveSticker && (
          <MenuItem icon="star-regular" onClick={onFaveSticker}>{lang('AddToFavorites')}</MenuItem>
        )}
        {canUnfaveSticker && (
          <MenuItem icon="star-regular" onClick={onUnfaveSticker}>{lang('StickersRemoveFromFavorites')}</MenuItem>
        )}
        {canTranslate && (
          <MenuItem icon="language" onClick={() => onTranslate?.()}>{lang('AiMessageEditorTranslate')}</MenuItem>
        )}
        {canShowOriginal && (
          <MenuItem icon="language" onClick={onShowOriginal}>
            {lang('ShowOriginalButton')}
          </MenuItem>
        )}
        {canShowOriginal && (
          <NestedMenuItem
            icon="tone"
            submenuClassName="translation-tone-menu"
            submenu={(
              <>
                <MenuItem
                  icon={currentTranslationTone === 'neutral' ? 'check' : undefined}
                  customIcon={currentTranslationTone !== 'neutral' ? <Icon name="placeholder" /> : undefined}
                  onClick={() => onTranslateWithTone?.('neutral')}
                >
                  {lang('TranslationToneNeutral')}
                </MenuItem>
                <MenuItem
                  icon={currentTranslationTone === 'formal' ? 'check' : undefined}
                  customIcon={currentTranslationTone !== 'formal' ? <Icon name="placeholder" /> : undefined}
                  onClick={() => onTranslateWithTone?.('formal')}
                >
                  {lang('TranslationToneFormal')}
                </MenuItem>
                <MenuItem
                  icon={currentTranslationTone === 'casual' ? 'check' : undefined}
                  customIcon={currentTranslationTone !== 'casual' ? <Icon name="placeholder" /> : undefined}
                  onClick={() => onTranslateWithTone?.('casual')}
                >
                  {lang('TranslationToneCasual')}
                </MenuItem>
              </>
            )}
          >
            {lang('TranslationTone')}
          </NestedMenuItem>
        )}
        {canSelectLanguage && (
          <MenuItem icon="web" onClick={onSelectLanguage}>{lang('Language')}</MenuItem>
        )}
        {copyOptions.map((option) => (
          isAltKeyPressed && option.canCopyWithFormat ? (
            <NestedMenuItem
              key={option.label}
              icon={option.icon}
              submenu={(
                <>
                  <MenuItem onClick={() => option.handler('plainText')}>{lang('CopyAsText')}</MenuItem>
                  <MenuItem onClick={() => option.handler('html')}>{lang('CopyAsHtml')}</MenuItem>
                  <MenuItem onClick={() => option.handler('markdown')}>{lang('CopyAsMarkdown')}</MenuItem>
                </>
              )}
            >
              {lang('Copy')}
            </NestedMenuItem>
          ) : (
            <MenuItem
              key={option.label}
              icon={option.icon}
              onClick={() => option.handler()}
              withPreventDefaultOnMouseDown
            >
              {lang(option.label)}
            </MenuItem>
          )
        ))}
        {canPin && <MenuItem icon="pin" onClick={onPin}>{lang('DialogPin')}</MenuItem>}
        {canUnpin && <MenuItem icon="unpin" onClick={onUnpin}>{lang('DialogUnpin')}</MenuItem>}
        {canSaveGif && <MenuItem icon="gifs" onClick={onSaveGif}>{lang('ContextSaveGif')}</MenuItem>}
        {canManageMusicInProfile && (
          !isMusicProfileStatusLoaded ? (
            <MenuItem customIcon={<span className="profile-music-menu-icon-placeholder" />} disabled>
              <Skeleton className="profile-music-menu-label-placeholder" animation="wave" />
            </MenuItem>
          ) : (
            <MenuItem
              icon={isMusicSaved ? 'remove-music' : 'add-music'}
              disabled={isMusicProfileActionLoading}
              onClick={onToggleMusicInProfile}
            >
              {lang(isMusicSaved ? 'AudioRemoveFromProfile' : 'AudioAddToProfile')}
            </MenuItem>
          )
        )}
        {canRevote && <MenuItem icon="revote" onClick={onCancelVote}>{lang('PollsRetract')}</MenuItem>}
        {canClosePoll && <MenuItem icon="stop" onClick={onClosePoll}>{lang('PollsStop')}</MenuItem>}
        {canDownload && (
          <MenuItem icon="download" onClick={onDownload}>
            {isDownloading ? lang('ContextCancelDownload') : lang('AccActionDownload')}
          </MenuItem>
        )}
        {canForward && <MenuItem icon="forward" onClick={onForward}>{lang('Forward')}</MenuItem>}
        {canSelect && <MenuItem icon="select" onClick={onSelect}>{lang('CommonSelect')}</MenuItem>}
        {canReport && <MenuItem icon="flag" onClick={onReport}>{lang('ReportPeerReport')}</MenuItem>}
        {canDelete && (message.anchorMsgId ? (
          <MenuItem destructive icon="reload" onClick={onDelete}>
            <MenuItemTitle>{lang('EphemeralRevert')}</MenuItemTitle>
            <MenuItemSubtitle>{lang('EphemeralRevertDescription')}</MenuItemSubtitle>
          </MenuItem>
        ) : <DeleteMenuItem autoDeleteAt={autoDeleteAt} onDelete={onDelete} />)}
        {message.isEphemeral && (
          <>
            <MenuSeparator size="thick" />
            <MenuItem className="smaller" disabled withWrap>
              {lang(message.anchorMsgId ? 'EphemeralAnchoredNotice' : 'EphemeralContextMenuNotice')}
            </MenuItem>
          </>
        )}
        {hasCustomEmoji && (
          <>
            <MenuSeparator size="thick" />
            {!customEmojiSets && (
              <>
                <Skeleton inline className="menu-loading-row" animation="wave" />
                <Skeleton inline className="menu-loading-row" animation="wave" />
              </>
            )}
            {customEmojiSets && customEmojiSets.length === 1 && (
              <MenuItem withWrap onClick={handleOpenCustomEmojiSets} className="menu-custom-emoji-sets">
                {lang('MessageContainsEmojiPack', { pack: customEmojiSets[0].title }, {
                  withNodes: true, withMarkdown: true,
                })}
              </MenuItem>
            )}
            {customEmojiSets && customEmojiSets.length > 1 && (
              <MenuItem withWrap onClick={handleOpenCustomEmojiSets} className="menu-custom-emoji-sets">
                {lang('MessageContainsEmojiPacks', { count: customEmojiSets.length }, {
                  pluralValue: customEmojiSets.length, withNodes: true, withMarkdown: true,
                })}
              </MenuItem>
            )}
          </>
        )}
        {(canShowSeenBy || canShowReactionsCount) && (
          <>
            <MenuSeparator size={hasCustomEmoji ? 'thin' : 'thick'} />
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
                        'ChatOutgoingContextMixedReactionCount',
                        { count: message.reactors.count, total: totalSeenCount },
                      )
                      : lang(
                        'ChatContextReactionCount',
                        { count: message.reactors.count },
                        { pluralValue: message.reactors.count },
                      )
                  ) : (
                    seenByDatesCount === 1 && seenByRecentPeers
                      ? renderText(
                        isUserId(seenByRecentPeers[0].id)
                          ? getUserFullName(lang, seenByRecentPeers[0] as ApiUser)!
                          : (seenByRecentPeers[0] as ApiChat).title,
                      ) : (
                        seenByDatesCount
                          ? lang(
                            'ConversationContextMenuSeen',
                            { count: seenByDatesCount },
                            { pluralValue: seenByDatesCount },
                          )
                          : lang('ConversationContextMenuNoViews')
                      )
                  )}
                </span>
              </span>
              <AvatarList className="avatars" size="micro" peers={seenByRecentPeers} />
            </MenuItem>
          </>
        )}
        {shouldRenderInfoSection && (
          <MenuSeparator size={hasCustomEmoji ? 'thin' : 'thick'} />
        )}
        {(canLoadReadDate || shouldRenderShowWhen) && (
          <ReadTimeMenuItem
            canLoadReadDate={canLoadReadDate}
            shouldRenderShowWhen={shouldRenderShowWhen}
            message={message}
            closeContextMenu={onClose}
          />
        )}
        {isEdited && (
          <LastEditTimeMenuItem
            message={message}
          />
        )}
        {pollSubscriberRestrictionMessage && (
          <MenuItem disabled withWrap className="poll-subscriber-restriction-notice">
            {lang.with(pollSubscriberRestrictionMessage)}
          </MenuItem>
        )}
        {pollCountryRestrictionMessage && (
          <MenuItem disabled withWrap className="poll-country-restriction-notice">
            {lang.with(pollCountryRestrictionMessage)}
          </MenuItem>
        )}
        {noForwardsNotice && (
          <MenuItem disabled withWrap className="no-forwards-notice">
            {noForwardsNotice}
          </MenuItem>
        )}
      </div>
    </Menu>
  );
};

export default memo(MessageContextMenu);
