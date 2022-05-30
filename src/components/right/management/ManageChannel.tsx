import type { ChangeEvent } from 'react';
import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { ManagementScreens, ManagementProgress } from '../../../types';
import type { ApiChat, ApiExportedInvite } from '../../../api/types';
import { ApiMediaFormat } from '../../../api/types';

import { getChatAvatarHash, getHasAdminRight } from '../../../global/helpers';
import useMedia from '../../../hooks/useMedia';
import useLang from '../../../hooks/useLang';
import { selectChat } from '../../../global/selectors';
import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';
import { formatInteger } from '../../../util/textFormat';

import AvatarEditable from '../../ui/AvatarEditable';
import InputText from '../../ui/InputText';
import ListItem from '../../ui/ListItem';
import Checkbox from '../../ui/Checkbox';
import Spinner from '../../ui/Spinner';
import FloatingActionButton from '../../ui/FloatingActionButton';
import ConfirmDialog from '../../ui/ConfirmDialog';

import './Management.scss';

type OwnProps = {
  chatId: string;
  onScreenSelect: (screen: ManagementScreens) => void;
  onClose: NoneToVoidFunction;
  isActive: boolean;
};

type StateProps = {
  chat: ApiChat;
  progress?: ManagementProgress;
  isSignaturesShown: boolean;
  canChangeInfo?: boolean;
  canInvite?: boolean;
  exportedInvites?: ApiExportedInvite[];
  lastSyncTime?: number;
  availableReactionsCount?: number;
};

const CHANNEL_TITLE_EMPTY = 'Channel title can\'t be empty';

const ManageChannel: FC<OwnProps & StateProps> = ({
  chatId,
  chat,
  progress,
  isSignaturesShown,
  canChangeInfo,
  canInvite,
  exportedInvites,
  lastSyncTime,
  availableReactionsCount,
  onScreenSelect,
  onClose,
  isActive,
}) => {
  const {
    updateChat,
    toggleSignatures,
    closeManagement,
    leaveChannel,
    deleteChannel,
    openChat,
    loadExportedChatInvites,
    loadChatJoinRequests,
  } = getActions();

  const currentTitle = chat ? (chat.title || '') : '';
  const currentAbout = chat?.fullInfo ? (chat.fullInfo.about || '') : '';
  const hasLinkedChat = chat?.fullInfo?.linkedChatId;

  const [isDeleteDialogOpen, openDeleteDialog, closeDeleteDialog] = useFlag();
  const [isProfileFieldsTouched, setIsProfileFieldsTouched] = useState(false);
  const [title, setTitle] = useState(currentTitle);
  const [about, setAbout] = useState(currentAbout);
  const [photo, setPhoto] = useState<File | undefined>();
  const [error, setError] = useState<string | undefined>();
  const imageHash = chat && getChatAvatarHash(chat);
  const currentAvatarBlobUrl = useMedia(imageHash, false, ApiMediaFormat.BlobUrl);
  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  useEffect(() => {
    if (lastSyncTime) {
      loadExportedChatInvites({ chatId });
      loadExportedChatInvites({ chatId, isRevoked: true });
      loadChatJoinRequests({ chatId });
    }
  }, [chatId, loadExportedChatInvites, lastSyncTime, loadChatJoinRequests]);

  useEffect(() => {
    if (progress === ManagementProgress.Complete) {
      setIsProfileFieldsTouched(false);
      setError(undefined);
    }
  }, [progress]);

  const adminsCount = (chat?.fullInfo?.adminMembers?.length) || 0;
  const removedUsersCount = (chat?.fullInfo?.kickedMembers?.length) || 0;

  const handleClickEditType = useCallback(() => {
    onScreenSelect(ManagementScreens.ChatPrivacyType);
  }, [onScreenSelect]);

  const handleClickDiscussion = useCallback(() => {
    onScreenSelect(ManagementScreens.Discussion);
  }, [onScreenSelect]);

  const handleClickReactions = useCallback(() => {
    onScreenSelect(ManagementScreens.Reactions);
  }, [onScreenSelect]);

  const handleClickAdministrators = useCallback(() => {
    onScreenSelect(ManagementScreens.ChatAdministrators);
  }, [onScreenSelect]);

  const handleClickInvites = useCallback(() => {
    onScreenSelect(ManagementScreens.Invites);
  }, [onScreenSelect]);

  const handleClickRequests = useCallback(() => {
    onScreenSelect(ManagementScreens.JoinRequests);
  }, [onScreenSelect]);

  const handleSetPhoto = useCallback((file: File) => {
    setPhoto(file);
    setIsProfileFieldsTouched(true);
  }, []);

  const handleTitleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    setIsProfileFieldsTouched(true);
  }, []);

  const handleAboutChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setAbout(e.target.value);
    setIsProfileFieldsTouched(true);
  }, []);

  const handleUpdateChannel = useCallback(() => {
    const trimmedTitle = title.trim();
    const trimmedAbout = about.trim();

    if (!trimmedTitle.length) {
      setError(CHANNEL_TITLE_EMPTY);
      return;
    }

    updateChat({
      chatId,
      title: trimmedTitle,
      about: trimmedAbout,
      photo,
    });
  }, [about, chatId, photo, title, updateChat]);

  const handleToggleSignatures = useCallback(() => {
    toggleSignatures({ chatId, isEnabled: !isSignaturesShown });
  }, [chatId, isSignaturesShown, toggleSignatures]);

  const handleClickSubscribers = useCallback(() => {
    onScreenSelect(ManagementScreens.ChannelSubscribers);
  }, [onScreenSelect]);

  const handleRemovedUsersClick = useCallback(() => {
    onScreenSelect(ManagementScreens.ChannelRemovedUsers);
  }, [onScreenSelect]);

  const handleDeleteChannel = useCallback(() => {
    if (chat.isCreator) {
      deleteChannel({ chatId: chat.id });
    } else {
      leaveChannel({ chatId: chat.id });
    }

    closeDeleteDialog();
    closeManagement();
    openChat({ id: undefined });
  }, [chat.isCreator, chat.id, closeDeleteDialog, closeManagement, leaveChannel, deleteChannel, openChat]);

  const enabledReactionsCount = chat.fullInfo?.enabledReactions?.length || 0;

  if (chat.isRestricted || chat.isForbidden) {
    return undefined;
  }

  const isLoading = progress === ManagementProgress.InProgress;

  return (
    <div className="Management">
      <div className="custom-scroll">
        <div className="section">
          <AvatarEditable
            currentAvatarBlobUrl={currentAvatarBlobUrl}
            onChange={handleSetPhoto}
            disabled={!canChangeInfo}
          />
          <InputText
            id="channel-title"
            label={lang('EnterChannelName')}
            onChange={handleTitleChange}
            value={title}
            error={error === CHANNEL_TITLE_EMPTY ? error : undefined}
            disabled={!canChangeInfo}
          />
          <InputText
            id="channel-about"
            className="mb-2"
            label={lang('DescriptionPlaceholder')}
            onChange={handleAboutChange}
            value={about}
            disabled={!canChangeInfo}
          />
          {chat.isCreator && (
            <ListItem icon="lock" multiline onClick={handleClickEditType}>
              <span className="title">{lang('ChannelType')}</span>
              <span className="subtitle">{chat.username ? lang('TypePublic') : lang('TypePrivate')}</span>
            </ListItem>
          )}
          <ListItem
            icon="message"
            multiline
            onClick={handleClickDiscussion}
            disabled={!canChangeInfo}
          >
            <span className="title">{lang('Discussion')}</span>
            <span className="subtitle">{hasLinkedChat ? lang('DiscussionUnlink') : lang('Add')}</span>
          </ListItem>
          {canInvite && (
            <ListItem
              icon="link"
              onClick={handleClickInvites}
              multiline
              disabled={!exportedInvites}
            >
              <span className="title">{lang('GroupInfo.InviteLinks')}</span>
              <span className="subtitle">
                {exportedInvites ? formatInteger(exportedInvites.length) : lang('Loading')}
              </span>
            </ListItem>
          )}
          {Boolean(chat.joinRequests?.length) && (
            <ListItem
              icon="add-user-filled"
              onClick={handleClickRequests}
              multiline
            >
              <span className="title">{lang('SubscribeRequests')}</span>
              <span className="subtitle">
                {formatInteger(chat.joinRequests!.length)}
              </span>
            </ListItem>
          )}
          <ListItem
            icon="heart-outline"
            multiline
            onClick={handleClickReactions}
            disabled={!canChangeInfo}
          >
            <span className="title">{lang('Reactions')}</span>
            <span className="subtitle" dir="auto">
              {enabledReactionsCount}/{availableReactionsCount}
            </span>
          </ListItem>
          <div className="ListItem no-selection narrow">
            <Checkbox
              checked={isSignaturesShown}
              label={lang('ChannelSignMessages')}
              onChange={handleToggleSignatures}
            />
          </div>
        </div>
        <div className="section">
          <ListItem
            icon="admin"
            multiline
            onClick={handleClickAdministrators}
          >
            <span className="title">{lang('ChannelAdministrators')}</span>
            <span className="subtitle">{adminsCount}</span>
          </ListItem>
          <ListItem
            icon="group"
            multiline
            onClick={handleClickSubscribers}
          >
            <span className="title" dir="auto">{lang('ChannelSubscribers')}</span>
            <span className="subtitle" dir="auto">{lang('Subscribers', chat.membersCount ?? 0, 'i')}</span>
          </ListItem>
          <ListItem
            icon="delete-user"
            multiline
            narrow
            onClick={handleRemovedUsersClick}
          >
            <span className="title">{lang('ChannelBlockedUsers')}</span>
            <span className="subtitle">{removedUsersCount}</span>
          </ListItem>
        </div>
        <div className="section">
          <ListItem icon="delete" ripple destructive onClick={openDeleteDialog}>
            {chat.isCreator ? lang('ChannelDelete') : lang('LeaveChannel')}
          </ListItem>
        </div>
      </div>
      <FloatingActionButton
        isShown={isProfileFieldsTouched}
        onClick={handleUpdateChannel}
        disabled={isLoading}
        ariaLabel={lang('Save')}
      >
        {isLoading ? (
          <Spinner color="white" />
        ) : (
          <i className="icon-check" />
        )}
      </FloatingActionButton>
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={closeDeleteDialog}
        text={chat.isCreator ? lang('ChannelDeleteAlert') : lang('ChannelLeaveAlert')}
        confirmLabel={chat.isCreator ? lang('ChannelDelete') : lang('LeaveChannel')}
        confirmHandler={handleDeleteChannel}
        confirmIsDestructive
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId)!;
    const { progress } = global.management;
    const isSignaturesShown = Boolean(chat?.isSignaturesShown);
    const { invites } = global.management.byChatId[chatId] || {};

    return {
      chat,
      progress,
      isSignaturesShown,
      canChangeInfo: getHasAdminRight(chat, 'changeInfo'),
      canInvite: getHasAdminRight(chat, 'inviteUsers'),
      lastSyncTime: global.lastSyncTime,
      exportedInvites: invites,
      availableReactionsCount: global.availableReactions?.filter((l) => !l.isInactive).length,
    };
  },
)(ManageChannel));
