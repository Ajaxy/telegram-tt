import type { FC } from '../../lib/teact/teact';
import {
  memo, useCallback, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { IAnchorPosition, MessageListType, ThreadId } from '../../types';
import { MAIN_THREAD_ID } from '../../api/types';
import { ManagementScreens } from '../../types';

import { requestMeasure, requestNextMutation } from '../../lib/fasterdom/fasterdom';
import {
  getHasAdminRight,
  getIsSavedDialog,
  isAnonymousForwardsChat,
  isChatBasicGroup, isChatChannel, isChatSuperGroup,
} from '../../global/helpers';
import {
  selectBot,
  selectCanAnimateInterface,
  selectCanTranslateChat,
  selectChat,
  selectChatFullInfo,
  selectIsChatBotNotStarted,
  selectIsChatRestricted,
  selectIsChatWithSelf,
  selectIsCurrentUserFrozen,
  selectIsInSelectMode,
  selectIsRightColumnShown,
  selectIsUserBlocked,
  selectLanguageCode,
  selectRequestedChatTranslationLanguage,
  selectTranslationLanguage,
  selectUserFullInfo,
} from '../../global/selectors';
import { ARE_CALLS_SUPPORTED, IS_APP } from '../../util/browser/windowEnvironment';
import { isUserId } from '../../util/entities/ids';
import focusNoScroll from '../../util/focusNoScroll';

import { useHotkeys } from '../../hooks/useHotkeys';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import Button from '../ui/Button';
import DropdownMenu from '../ui/DropdownMenu';
import MenuItem from '../ui/MenuItem';
import MenuSeparator from '../ui/MenuSeparator';
import HeaderMenuContainer from './HeaderMenuContainer.async';

interface OwnProps {
  chatId: string;
  threadId: ThreadId;
  messageListType: MessageListType;
  canExpandActions: boolean;
  isForForum?: boolean;
  isMobile?: boolean;
  onTopicSearch?: NoneToVoidFunction;
}

interface StateProps {
  noMenu?: boolean;
  isChannel?: boolean;
  isRightColumnShown?: boolean;
  canStartBot?: boolean;
  canRestartBot?: boolean;
  canUnblock?: boolean;
  canSubscribe?: boolean;
  canSearch?: boolean;
  canCall?: boolean;
  canMute?: boolean;
  canViewStatistics?: boolean;
  canViewMonetization?: boolean;
  canViewBoosts?: boolean;
  canShowBoostModal?: boolean;
  canLeave?: boolean;
  canEnterVoiceChat?: boolean;
  canCreateVoiceChat?: boolean;
  channelMonoforumId?: string;
  pendingJoinRequests?: number;
  shouldJoinToSend?: boolean;
  shouldSendJoinRequest?: boolean;
  noAnimation?: boolean;
  canTranslate?: boolean;
  isTranslating?: boolean;
  translationLanguage: string;
  language: string;
  detectedChatLanguage?: string;
  doNotTranslate: string[];
  isAccountFrozen?: boolean;
}

const HeaderActions: FC<OwnProps & StateProps> = ({
  chatId,
  threadId,
  noMenu,
  isMobile,
  isChannel,
  canStartBot,
  canRestartBot,
  canUnblock,
  canSubscribe,
  canSearch,
  canCall,
  canMute,
  canViewStatistics,
  canViewMonetization,
  canViewBoosts,
  canShowBoostModal,
  canLeave,
  canEnterVoiceChat,
  canCreateVoiceChat,
  channelMonoforumId,
  pendingJoinRequests,
  isRightColumnShown,
  isForForum,
  canExpandActions,
  shouldJoinToSend,
  shouldSendJoinRequest,
  noAnimation,
  canTranslate,
  isTranslating,
  translationLanguage,
  language,
  detectedChatLanguage,
  doNotTranslate,
  isAccountFrozen,
  onTopicSearch,
}) => {
  const {
    joinChannel,
    sendBotCommand,
    openMiddleSearch,
    restartBot,
    requestMasterAndRequestCall,
    requestNextManagementScreen,
    showNotification,
    openChat,
    requestChatTranslation,
    togglePeerTranslations,
    openChatLanguageModal,
    setSettingOption,
    unblockUser,
    setViewForumAsMessages,
    openFrozenAccountModal,
  } = getActions();
  const menuButtonRef = useRef<HTMLButtonElement>();
  const lang = useOldLang();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<IAnchorPosition | undefined>(undefined);

  const handleHeaderMenuOpen = useLastCallback(() => {
    setIsMenuOpen(true);
    const rect = menuButtonRef.current!.getBoundingClientRect();
    setMenuAnchor({ x: rect.right, y: rect.bottom });
  });

  const handleHeaderMenuClose = useLastCallback(() => {
    setIsMenuOpen(false);
  });

  const handleHeaderMenuHide = useLastCallback(() => {
    setMenuAnchor(undefined);
  });

  const handleSubscribeClick = useLastCallback(() => {
    joinChannel({ chatId });
    if (shouldSendJoinRequest) {
      showNotification({
        message: isChannel ? lang('RequestToJoinChannelSentDescription') : lang('RequestToJoinGroupSentDescription'),
      });
    }
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

  const handleTranslateClick = useLastCallback(() => {
    if (isTranslating) {
      requestChatTranslation({ chatId, toLanguageCode: undefined });
      return;
    }

    requestChatTranslation({ chatId, toLanguageCode: translationLanguage });
  });

  const handleJoinRequestsClick = useLastCallback(() => {
    requestNextManagementScreen({ screen: ManagementScreens.JoinRequests });
  });

  const handleSearchClick = useLastCallback(() => {
    if (isForForum) {
      onTopicSearch?.();
      return;
    }

    openMiddleSearch();

    if (noAnimation) {
      // The second RAF is necessary because Teact must update the state and render the async component
      requestMeasure(() => {
        requestNextMutation(setFocusInSearchInput);
      });
    } else {
      setFocusInSearchInput();
    }
  });

  const handleAsMessagesClick = useLastCallback(() => {
    openChat({ id: chatId });
    setViewForumAsMessages({ chatId, isEnabled: true });
  });

  const handleRequestCall = useLastCallback(() => {
    if (isAccountFrozen) {
      openFrozenAccountModal();
      return;
    }
    requestMasterAndRequestCall({ userId: chatId });
  });

  const handleHotkeySearchClick = useLastCallback((e: KeyboardEvent) => {
    if (!canSearch || !IS_APP || e.shiftKey) {
      return;
    }

    e.preventDefault();
    handleSearchClick();
  });

  const getTextWithLanguage = useCallback((langKey: string, langCode: string) => {
    const simplified = langCode.split('-')[0];
    const translationKey = `TranslateLanguage${simplified.toUpperCase()}`;
    const name = lang(translationKey);
    if (name !== translationKey) {
      return lang(langKey, name);
    }

    const translatedNames = new Intl.DisplayNames([language], { type: 'language' });
    const translatedName = translatedNames.of(langCode)!;
    return lang(`${langKey}Other`, translatedName);
  }, [language, lang]);

  const buttonText = useMemo(() => {
    if (isTranslating) return lang('ShowOriginalButton');

    return getTextWithLanguage('TranslateToButton', translationLanguage);
  }, [translationLanguage, getTextWithLanguage, isTranslating, lang]);

  const doNotTranslateText = useMemo(() => {
    if (!detectedChatLanguage) return undefined;

    return getTextWithLanguage('DoNotTranslateLanguage', detectedChatLanguage);
  }, [getTextWithLanguage, detectedChatLanguage]);

  const handleHide = useLastCallback(() => {
    togglePeerTranslations({ chatId, isEnabled: false });
    requestChatTranslation({ chatId, toLanguageCode: undefined });
  });

  const handleChangeLanguage = useLastCallback(() => {
    openChatLanguageModal({ chatId });
  });

  const handleDoNotTranslate = useLastCallback(() => {
    if (!detectedChatLanguage) return;

    setSettingOption({
      doNotTranslate: [...doNotTranslate, detectedChatLanguage],
    });
    requestChatTranslation({ chatId, toLanguageCode: undefined });

    showNotification({ message: getTextWithLanguage('AddedToDoNotTranslate', detectedChatLanguage) });
  });

  useHotkeys(useMemo(() => ({
    'Mod+F': handleHotkeySearchClick,
  }), []));

  const MoreMenuButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isOpen }) => (
      <Button
        round
        ripple={isRightColumnShown}
        color="translucent"
        size="smaller"
        className={isOpen ? 'active' : ''}
        onClick={onTrigger}
        ariaLabel={lang('TranslateMessage')}
        iconName="language"
      />
    );
  }, [isRightColumnShown, lang]);

  return (
    <div className="HeaderActions">
      {!isForForum && canTranslate && (
        <DropdownMenu
          className="stickers-more-menu with-menu-transitions"
          trigger={MoreMenuButton}
          positionX="right"
        >
          <MenuItem icon="language" onClick={handleTranslateClick}>
            {buttonText}
          </MenuItem>
          <MenuItem icon="replace" onClick={handleChangeLanguage}>
            {lang('Chat.Translate.Menu.To')}
          </MenuItem>
          <MenuSeparator />
          {detectedChatLanguage
            && <MenuItem icon="hand-stop" onClick={handleDoNotTranslate}>{doNotTranslateText}</MenuItem>}
          <MenuItem icon="close-circle" onClick={handleHide}>{lang('Hide')}</MenuItem>
        </DropdownMenu>
      )}
      {!isMobile && (
        <>
          {canExpandActions && !shouldSendJoinRequest && (canSubscribe || shouldJoinToSend) && (
            <Button
              size="smaller"
              ripple
              fluid
              onClick={handleSubscribeClick}
            >
              {lang(isChannel ? 'ProfileJoinChannel' : 'ProfileJoinGroup')}
            </Button>
          )}
          {canExpandActions && shouldSendJoinRequest && (
            <Button
              size="smaller"
              ripple
              fluid
              onClick={handleSubscribeClick}
            >
              {lang('ChannelJoinRequest')}
            </Button>
          )}
          {canExpandActions && canStartBot && (
            <Button
              size="smaller"
              ripple
              fluid
              onClick={handleStartBot}
            >
              {lang('BotStart')}
            </Button>
          )}
          {canExpandActions && canRestartBot && (
            <Button
              size="tiny"
              ripple
              fluid
              onClick={handleRestartBot}
            >
              {lang('BotRestart')}
            </Button>
          )}
          {canExpandActions && canUnblock && (
            <Button
              size="smaller"
              ripple
              fluid
              onClick={handleUnblock}
            >
              {lang('Unblock')}
            </Button>
          )}
          {canSearch && (
            <Button
              round
              ripple={isRightColumnShown}
              color="translucent"
              size="smaller"
              onClick={handleSearchClick}
              ariaLabel={lang('Conversation.SearchPlaceholder')}
              iconName="search"
            />
          )}
          {canCall && (
            <Button
              round
              color="translucent"
              size="smaller"
              onClick={handleRequestCall}
              ariaLabel="Call"
              iconName="phone"
            />
          )}
        </>
      )}
      {!isForForum && Boolean(pendingJoinRequests) && (
        <Button
          round
          className="badge-button"
          ripple={isRightColumnShown}
          color="translucent"
          size="smaller"
          iconName="user"
          onClick={handleJoinRequestsClick}
          ariaLabel={isChannel ? lang('SubscribeRequests') : lang('MemberRequests')}
        >
          <div className="badge">{pendingJoinRequests}</div>
        </Button>
      )}
      <Button
        ref={menuButtonRef}
        className={isMenuOpen ? 'active' : ''}
        round
        ripple={!isMobile}
        size="smaller"
        color="translucent"
        disabled={noMenu}
        ariaLabel="More actions"
        onClick={handleHeaderMenuOpen}
        iconName="more"
      />
      {menuAnchor && (
        <HeaderMenuContainer
          chatId={chatId}
          threadId={threadId}
          isOpen={isMenuOpen}
          anchor={menuAnchor}
          withExtraActions={isMobile || !canExpandActions}
          isChannel={isChannel}
          canStartBot={canStartBot}
          canSubscribe={canSubscribe}
          canSearch={canSearch}
          canCall={canCall}
          canMute={canMute}
          canViewStatistics={canViewStatistics}
          canViewBoosts={canViewBoosts}
          canViewMonetization={canViewMonetization}
          canShowBoostModal={canShowBoostModal}
          canLeave={canLeave}
          canEnterVoiceChat={canEnterVoiceChat}
          canCreateVoiceChat={canCreateVoiceChat}
          pendingJoinRequests={pendingJoinRequests}
          onJoinRequestsClick={handleJoinRequestsClick}
          withForumActions={isForForum}
          channelMonoforumId={channelMonoforumId}
          onSubscribeChannel={handleSubscribeClick}
          onSearchClick={handleSearchClick}
          onAsMessagesClick={handleAsMessagesClick}
          onClose={handleHeaderMenuClose}
          onCloseAnimationEnd={handleHeaderMenuHide}
        />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, {
    chatId, threadId, messageListType, isMobile,
  }): Complete<StateProps> => {
    const chat = selectChat(global, chatId);
    const isChannel = Boolean(chat && isChatChannel(chat));
    const isSuperGroup = Boolean(chat && isChatSuperGroup(chat));
    const language = selectLanguageCode(global);
    const translationLanguage = selectTranslationLanguage(global);
    const isPrivate = isUserId(chatId);
    const { doNotTranslate } = global.settings.byKey;

    const isRestricted = selectIsChatRestricted(global, chatId);
    if (!chat || isRestricted || selectIsInSelectMode(global)) {
      return {
        noMenu: true,
        language,
        translationLanguage,
        doNotTranslate,
      } as Complete<StateProps>;
    }

    const bot = selectBot(global, chatId);
    const chatFullInfo = !isPrivate ? selectChatFullInfo(global, chatId) : undefined;
    const userFullInfo = isPrivate ? selectUserFullInfo(global, chatId) : undefined;
    const fullInfo = chatFullInfo || userFullInfo;
    const isChatWithSelf = selectIsChatWithSelf(global, chatId);
    const isMainThread = messageListType === 'thread' && threadId === MAIN_THREAD_ID;
    const isDiscussionThread = messageListType === 'thread' && threadId !== MAIN_THREAD_ID;
    const isRightColumnShown = selectIsRightColumnShown(global, isMobile);

    const isSavedDialog = getIsSavedDialog(chatId, threadId, global.currentUserId);

    const isUserBlocked = isPrivate ? selectIsUserBlocked(global, chatId) : false;
    const canRestartBot = Boolean(bot && isUserBlocked);
    const canStartBot = !canRestartBot && Boolean(selectIsChatBotNotStarted(global, chatId));
    const canUnblock = isUserBlocked && !bot;
    const canSubscribe = Boolean(
      (isMainThread || chat.isForum) && (isChannel || isSuperGroup) && chat.isNotJoined && !chat.isMonoforum,
    );
    const canSearch = isMainThread || isDiscussionThread;
    const canCall = ARE_CALLS_SUPPORTED && isUserId(chat.id) && !isChatWithSelf && !bot && !chat.isSupport
      && !isAnonymousForwardsChat(chat.id);
    const canMute = isMainThread && !isChatWithSelf && !canSubscribe;
    const canLeave = isSavedDialog || (isMainThread && !canSubscribe);
    const canEnterVoiceChat = ARE_CALLS_SUPPORTED && isMainThread && chat.isCallActive;
    const canCreateVoiceChat = ARE_CALLS_SUPPORTED && isMainThread && !chat.isCallActive
      && (chat.adminRights?.manageCall || (chat.isCreator && isChatBasicGroup(chat))) && !chat.isMonoforum;
    const canViewStatistics = isMainThread && chatFullInfo?.canViewStatistics;
    const canViewMonetization = isMainThread && chatFullInfo?.canViewMonetization;
    const canViewBoosts = isMainThread && !chat.isMonoforum
      && (isSuperGroup || isChannel) && (canViewStatistics || getHasAdminRight(chat, 'postStories'));
    const canShowBoostModal = !canViewBoosts && (isSuperGroup || isChannel) && !chat.isMonoforum;
    const pendingJoinRequests = isMainThread ? chatFullInfo?.requestsPending : undefined;
    const shouldJoinToSend = Boolean(chat?.isNotJoined && chat.isJoinToSend);
    const shouldSendJoinRequest = Boolean(chat?.isNotJoined && chat.isJoinRequest);
    const noAnimation = !selectCanAnimateInterface(global);

    const isTranslating = Boolean(selectRequestedChatTranslationLanguage(global, chatId));
    const canTranslate = selectCanTranslateChat(global, chatId) && !fullInfo?.isTranslationDisabled;
    const isAccountFrozen = selectIsCurrentUserFrozen(global);

    const channelMonoforumId = isChatChannel(chat) ? chat.linkedMonoforumId : undefined;

    return {
      noMenu: false,
      isChannel,
      isRightColumnShown,
      canStartBot,
      canRestartBot,
      canSubscribe,
      canSearch,
      canCall,
      canMute,
      canViewStatistics,
      canViewMonetization,
      canViewBoosts,
      canShowBoostModal,
      canLeave,
      canEnterVoiceChat,
      canCreateVoiceChat,
      pendingJoinRequests,
      shouldJoinToSend,
      shouldSendJoinRequest,
      noAnimation,
      canTranslate,
      isTranslating,
      translationLanguage,
      language,
      doNotTranslate,
      detectedChatLanguage: chat.detectedLanguage,
      canUnblock,
      isAccountFrozen,
      channelMonoforumId,
    };
  },
)(HeaderActions));

function setFocusInSearchInput() {
  const searchInput = document.querySelector<HTMLInputElement>('#MiddleSearch input');
  if (searchInput) {
    focusNoScroll(searchInput);
  }
}
