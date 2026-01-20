import type { FC } from '../../../lib/teact/teact';
import type React from '../../../lib/teact/teact';
import {
  memo,
  useEffect,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiMessage,
  ApiPeer,
} from '../../../api/types';

import {
  EDITABLE_INPUT_CSS_SELECTOR,
  MESSAGE_APPEARANCE_DELAY,
} from '../../../config';
import {
  getMainUsername,
  isAnonymousForwardsChat,
  isAnonymousOwnMessage,
  isChatChannel,
  isSystemBot,
} from '../../../global/helpers';
import { isApiPeerUser } from '../../../global/helpers/peers';
import {
  selectChat,
  selectForwardedSender,
  selectIsChatWithSelf,
  selectSender,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';

import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useShowTransition from '../../../hooks/useShowTransition';

import Avatar from '../../common/Avatar';
import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';

import styles from './SenderGroupContainer.module.scss';

type OwnProps =
  {
    message: ApiMessage;
    withAvatar?: boolean;
    children: React.ReactNode;
    id: string;
    appearanceOrder: number;
    canPost?: boolean;
  };

type StateProps = {
  sender?: ApiPeer;
  canShowSender: boolean;
  originSender?: ApiPeer;
  isChatWithSelf?: boolean;
  isRepliesChat?: boolean;
  isAnonymousForwards?: boolean;
  isChannel?: boolean;
};

const SenderGroupContainer: FC<OwnProps & StateProps> = ({
  message,
  withAvatar,
  children,
  id,
  appearanceOrder,
  sender,
  canShowSender,
  originSender,
  isChatWithSelf,
  isRepliesChat,
  isAnonymousForwards,
  isChannel,
  canPost,
}) => {
  const { openChat, updateInsertingPeerIdMention, openMiddleSearch } = getActions();

  const { forwardInfo } = message;

  const messageSender = canShowSender ? sender : undefined;
  const lang = useLang();

  const noAppearanceAnimation = appearanceOrder <= 0;
  const [isShown, markShown] = useFlag(noAppearanceAnimation);
  useEffect(() => {
    if (noAppearanceAnimation) {
      return;
    }

    setTimeout(markShown, appearanceOrder * MESSAGE_APPEARANCE_DELAY);
  }, [appearanceOrder, markShown, noAppearanceAnimation]);

  const shouldPreferOriginSender = forwardInfo
    && (isChatWithSelf || isRepliesChat || isAnonymousForwards || !messageSender);
  const avatarPeer = shouldPreferOriginSender ? originSender : messageSender;
  const isAvatarPeerUser = avatarPeer && isApiPeerUser(avatarPeer);

  const handleOpenChat = useLastCallback(() => {
    if (!avatarPeer) {
      return;
    }

    openChat({ id: avatarPeer.id });
  });

  const handleMention = useLastCallback(() => {
    if (!avatarPeer) {
      return;
    }

    const messageInput = document.querySelector<HTMLDivElement>(EDITABLE_INPUT_CSS_SELECTOR);
    if (messageInput) {
      updateInsertingPeerIdMention({ peerId: avatarPeer.id });
    }
  });

  const handleSearchMessages = useLastCallback(() => {
    if (!avatarPeer) {
      return;
    }

    openMiddleSearch({ fromPeerId: avatarPeer.id });
  });

  const handleAvatarClick = useLastCallback(() => {
    handleOpenChat();
  });

  const {
    ref: avatarRef,
    shouldRender,
  } = useShowTransition({
    isOpen: withAvatar && isShown,
    noMountTransition: isShown,
    withShouldRender: true,
  });

  const {
    isContextMenuOpen, contextMenuAnchor,
    handleContextMenu, handleContextMenuClose,
    handleContextMenuHide,
  } = useContextMenuHandlers(avatarRef);

  const getTriggerElement = useLastCallback(() => avatarRef.current);
  const getRootElement = useLastCallback(() => document.querySelector('.Transition_slide-active > .MessageList'));
  const getMenuElement = useLastCallback(
    () => avatarRef?.current?.querySelector(`.${styles.contextMenu} .bubble`),
  );
  const getLayout = useLastCallback(() => ({ withPortal: true }));

  const canMention = canPost && avatarPeer && (isAvatarPeerUser || Boolean(getMainUsername(avatarPeer)));
  const canSearch = !isChannel;
  const shouldRenderContextMenu = Boolean(contextMenuAnchor) && (isAvatarPeerUser || canMention || canSearch);

  function renderContextMenu() {
    return (
      <Menu
        isOpen={isContextMenuOpen}
        anchor={contextMenuAnchor}
        getTriggerElement={getTriggerElement}
        getRootElement={getRootElement}
        getLayout={getLayout}
        getMenuElement={getMenuElement}
        className={styles.contextMenu}
        onClose={handleContextMenuClose}
        onCloseAnimationEnd={handleContextMenuHide}
        withPortal
        autoClose
      >
        <>
          {isAvatarPeerUser && (
            <MenuItem
              icon="comments"
              onClick={handleOpenChat}
            >
              {lang('SendMessage')}
            </MenuItem>
          )}
          {canMention && (
            <MenuItem
              icon="mention"
              onClick={handleMention}
            >
              {lang('ContextMenuItemMention')}
            </MenuItem>
          )}
          {canSearch && (
            <MenuItem
              icon="search"
              onClick={handleSearchMessages}
            >
              {lang('Search')}
            </MenuItem>
          )}
        </>
      </Menu>
    );
  }

  function renderAvatar() {
    const hiddenName = (!avatarPeer && forwardInfo) ? forwardInfo.hiddenUserName : undefined;

    return (
      <Avatar
        size="small"
        className={styles.senderAvatar}
        peer={avatarPeer}
        text={hiddenName}
        onClick={avatarPeer ? handleAvatarClick : undefined}
        onContextMenu={handleContextMenu}
      />
    );
  }

  const className = buildClassName(
    'sender-group-container',
    styles.root,
  );

  return (
    <div id={id} className={className}>
      {shouldRender && (
        <div ref={avatarRef} className={styles.avatarContainer}>
          {renderAvatar()}
          {shouldRenderContextMenu && renderContextMenu()}
        </div>
      )}
      {children}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, ownProps): Complete<StateProps> => {
    const {
      message, withAvatar,
    } = ownProps;
    const { chatId } = message;

    const chat = selectChat(global, chatId);
    const isChatWithSelf = selectIsChatWithSelf(global, chatId);
    const isSystemBotChat = isSystemBot(chatId);
    const isAnonymousForwards = isAnonymousForwardsChat(chatId);

    const forceSenderName = !isChatWithSelf && isAnonymousOwnMessage(message);
    const canShowSender = withAvatar || forceSenderName;
    const sender = selectSender(global, message);
    const originSender = selectForwardedSender(global, message);

    return {
      sender,
      canShowSender,
      originSender,
      isChatWithSelf,
      isRepliesChat: isSystemBotChat,
      isAnonymousForwards,
      isChannel: chat && isChatChannel(chat),
    };
  },
)(SenderGroupContainer));
