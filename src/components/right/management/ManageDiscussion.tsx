import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChat } from '../../../api/types';
import { ManagementScreens } from '../../../types';

import { STICKER_SIZE_DISCUSSION_GROUPS } from '../../../config';
import { isChatChannel } from '../../../global/helpers';
import { selectChat, selectChatFullInfo } from '../../../global/selectors';
import { LOCAL_TGS_URLS } from '../../common/helpers/animatedAssets';
import renderText from '../../common/helpers/renderText';

import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useOldLang from '../../../hooks/useOldLang';

import AnimatedIconWithPreview from '../../common/AnimatedIconWithPreview';
import Avatar from '../../common/Avatar';
import GroupChatInfo from '../../common/GroupChatInfo';
import NothingFound from '../../common/NothingFound';
import Checkbox from '../../ui/Checkbox';
import ConfirmDialog from '../../ui/ConfirmDialog';
import ListItem from '../../ui/ListItem';

type OwnProps = {
  chatId: string;
  onScreenSelect: (screen: ManagementScreens) => void;
  onClose: NoneToVoidFunction;
  isActive: boolean;
};

type StateProps = {
  chat?: ApiChat;
  chatsByIds: Record<string, ApiChat>;
  linkedChat?: ApiChat;
  forDiscussionIds?: string[];
  isChannel?: boolean;
};

const ManageDiscussion: FC<OwnProps & StateProps> = ({
  chat,
  onClose,
  isActive,
  chatId,
  chatsByIds,
  linkedChat,
  forDiscussionIds,
  isChannel,
  onScreenSelect,
}) => {
  const {
    loadGroupsForDiscussion,
    linkDiscussionGroup,
    unlinkDiscussionGroup,
    toggleJoinRequest,
    toggleJoinToSend,
  } = getActions();

  const [linkedGroupId, setLinkedGroupId] = useState<string>();
  const [isConfirmUnlinkGroupDialogOpen, openConfirmUnlinkGroupDialog, closeConfirmUnlinkGroupDialog] = useFlag();
  const [isConfirmLinkGroupDialogOpen, openConfirmLinkGroupDialog, closeConfirmLinkGroupDialog] = useFlag();
  const [isJoinToSend, setIsJoinToSend] = useState(Boolean(linkedChat?.isJoinToSend));
  const [isJoinRequest, setIsJoinRequest] = useState(Boolean(linkedChat?.isJoinRequest));
  const lang = useOldLang();
  const linkedChatId = linkedChat?.id;

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  useEffect(() => {
    loadGroupsForDiscussion();
  }, [loadGroupsForDiscussion]);

  useEffect(() => {
    if (isActive) {
      setIsJoinToSend(linkedChat?.isJoinToSend || false);
      setIsJoinRequest(linkedChat?.isJoinRequest || false);
    }
  }, [linkedChat, isActive]);

  const handleUnlinkGroupSessions = useCallback(() => {
    closeConfirmUnlinkGroupDialog();
    unlinkDiscussionGroup({ channelId: isChannel ? chatId : linkedChatId! });
    if (!isChannel) {
      onScreenSelect(ManagementScreens.Initial);
    }
  }, [closeConfirmUnlinkGroupDialog, unlinkDiscussionGroup, isChannel, chatId, linkedChatId, onScreenSelect]);

  const handleLinkGroupSessions = useCallback(() => {
    closeConfirmLinkGroupDialog();
    linkDiscussionGroup({ channelId: chatId, chatId: linkedGroupId! });
  }, [closeConfirmLinkGroupDialog, linkDiscussionGroup, chatId, linkedGroupId]);

  const handleJoinToSendCheck = useCallback((checked: boolean) => {
    setIsJoinToSend(checked);
    toggleJoinToSend({ chatId: linkedChatId!, isEnabled: checked });
    if (!checked) {
      setIsJoinRequest(false);
    }
  }, [linkedChatId, toggleJoinToSend]);

  const handleJoinRequestCheck = useCallback((checked: boolean) => {
    setIsJoinRequest(checked);
    toggleJoinRequest({ chatId: linkedChatId!, isEnabled: checked });
  }, [linkedChatId, toggleJoinRequest]);

  const onDiscussionClick = (groupId: string) => {
    setLinkedGroupId(groupId);
    openConfirmLinkGroupDialog();
  };

  function renderUnlinkGroupHeader() {
    return (
      <div className="modal-header">
        <Avatar
          size="tiny"
          peer={linkedChat}
        />
        <div className="modal-title">
          {lang(isChannel ? 'DiscussionUnlinkGroup' : 'DiscussionUnlinkChannel')}
        </div>
      </div>
    );
  }

  function renderLinkGroupHeader() {
    if (!linkedGroupId) return undefined;
    const linkedGroup = chatsByIds[linkedGroupId];
    if (!linkedGroup) return undefined;

    return (
      <div className="modal-header">
        <Avatar
          size="tiny"
          peer={linkedGroup}
        />
        <div className="modal-title">
          {lang('Channel.DiscussionGroup.LinkGroup')}
        </div>
      </div>
    );
  }

  function renderLinkGroupConfirmText() {
    if (!linkedGroupId) return undefined;
    const linkedGroup = chatsByIds[linkedGroupId];
    if (!linkedGroup) return undefined;

    if (linkedGroup.hasPrivateLink) {
      return renderText(
        `Do you want to make **${linkedGroup.title}** the discussion board for **${chat!.title}**?`,
        ['br', 'simple_markdown'],
      );
    }

    return renderText(
      // eslint-disable-next-line max-len
      `Do you want to make **${linkedGroup.title}** the discussion board for **${chat!.title}**?\n\nAnyone from the channel will be able to see messages in this group.`,
      ['br', 'simple_markdown'],
    );
  }

  function renderLinkedGroup() {
    return (
      <div>
        <ListItem
          className="chat-item-clickable"
          inactive
        >
          <GroupChatInfo chatId={linkedChat!.id} />
        </ListItem>
        <ListItem
          icon="delete"
          ripple
          destructive
          onClick={openConfirmUnlinkGroupDialog}
        >
          {lang(isChannel ? 'DiscussionUnlinkGroup' : 'DiscussionUnlinkChannel')}
        </ListItem>
        <ConfirmDialog
          isOpen={isConfirmUnlinkGroupDialogOpen}
          onClose={closeConfirmUnlinkGroupDialog}
          header={renderUnlinkGroupHeader()}
          textParts={renderText(
            lang(isChannel ? 'DiscussionUnlinkChannelAlert' : 'DiscussionUnlinkGroupAlert', linkedChat!.title),
            ['br', 'simple_markdown'],
          )}
          confirmLabel={lang(isChannel ? 'DiscussionUnlinkGroup' : 'DiscussionUnlinkChannel')}
          confirmHandler={handleUnlinkGroupSessions}
          confirmIsDestructive
        />
      </div>
    );
  }

  function renderDiscussionGroups() {
    return (
      <div>
        <p className="section-help" dir="auto">{lang('DiscussionChannelHelp')}</p>

        <div teactFastList>
          <ListItem
            key="create-group"
            icon="group"
            ripple
            teactOrderKey={0}
            disabled
          >
            {lang('DiscussionCreateGroup')}
          </ListItem>
          {forDiscussionIds ? (
            forDiscussionIds.map((id, i) => (
              <ListItem
                key={id}
                teactOrderKey={i + 1}
                className="chat-item-clickable scroll-item"
                // eslint-disable-next-line react/jsx-no-bind
                onClick={() => {
                  onDiscussionClick(id);
                }}
              >
                <GroupChatInfo chatId={id} />
              </ListItem>
            ))
          ) : (
            <NothingFound key="nothing-found" teactOrderKey={0} text="No discussion groups found" />
          )}
        </div>
        <p className="mt-4 mb-0 section-help" dir="auto">{lang('DiscussionChannelHelp2')}</p>
        <ConfirmDialog
          isOpen={isConfirmLinkGroupDialogOpen}
          onClose={closeConfirmLinkGroupDialog}
          header={renderLinkGroupHeader()}
          textParts={renderLinkGroupConfirmText()}
          confirmLabel={lang('DiscussionLinkGroup')}
          confirmHandler={handleLinkGroupSessions}
        />
      </div>
    );
  }

  return (
    <div className="Management">
      <div className="custom-scroll">
        <div className="section">
          <AnimatedIconWithPreview
            tgsUrl={LOCAL_TGS_URLS.DiscussionGroups}
            size={STICKER_SIZE_DISCUSSION_GROUPS}
            className="section-icon"
          />
          {linkedChat && renderLinkedGroup()}
          {!linkedChat && renderDiscussionGroups()}
        </div>
        {linkedChat && (
          <div className="section">
            <h3 className="section-heading">{lang('ChannelSettingsJoinTitle')}</h3>
            <div className="ListItem narrow">
              <Checkbox
                checked={isJoinToSend}
                onCheck={handleJoinToSendCheck}
                label={lang('ChannelSettingsJoinToSend')}
              />
            </div>
            {isJoinToSend && (
              <div className="ListItem narrow">
                <Checkbox
                  checked={isJoinRequest}
                  onCheck={handleJoinRequestCheck}
                  label={lang('ChannelSettingsJoinRequest')}
                />
              </div>
            )}
            <p className="section-info section-info_push">
              {isJoinToSend ? lang('ChannelSettingsJoinRequestInfo') : lang('ChannelSettingsJoinToSendInfo')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId);
    const { linkedChatId } = selectChatFullInfo(global, chatId) || {};
    const { forDiscussionIds, byId: chatsByIds } = global.chats;
    const linkedChat = linkedChatId ? selectChat(global, linkedChatId) : undefined;

    return {
      chat,
      chatsByIds,
      forDiscussionIds,
      linkedChat,
      isChannel: chat && isChatChannel(chat),
    };
  },
)(ManageDiscussion));
