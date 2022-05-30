import type { ChangeEvent } from 'react';
import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { ManagementScreens, ManagementProgress } from '../../../types';
import type { ApiChat, ApiChatBannedRights, ApiExportedInvite } from '../../../api/types';
import { ApiMediaFormat } from '../../../api/types';

import { getChatAvatarHash, getHasAdminRight, isChatBasicGroup } from '../../../global/helpers';
import useMedia from '../../../hooks/useMedia';
import useLang from '../../../hooks/useLang';
import useFlag from '../../../hooks/useFlag';
import { selectChat } from '../../../global/selectors';
import { formatInteger } from '../../../util/textFormat';
import renderText from '../../common/helpers/renderText';
import useHistoryBack from '../../../hooks/useHistoryBack';

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
  isBasicGroup: boolean;
  hasLinkedChannel: boolean;
  canChangeInfo?: boolean;
  canBanUsers?: boolean;
  canInvite?: boolean;
  exportedInvites?: ApiExportedInvite[];
  lastSyncTime?: number;
  availableReactionsCount?: number;
};

const GROUP_TITLE_EMPTY = 'Group title can\'t be empty';

// Some checkboxes control multiple rights, and some rights are not controlled from Permissions screen,
// so we need to define the amount manually
const TOTAL_PERMISSIONS_COUNT = 8;

const ManageGroup: FC<OwnProps & StateProps> = ({
  chatId,
  chat,
  progress,
  isBasicGroup,
  hasLinkedChannel,
  canChangeInfo,
  canBanUsers,
  canInvite,
  onScreenSelect,
  onClose,
  isActive,
  exportedInvites,
  lastSyncTime,
  availableReactionsCount,
}) => {
  const {
    togglePreHistoryHidden,
    updateChat,
    deleteChat,
    leaveChannel,
    deleteChannel,
    closeManagement,
    openChat,
    loadExportedChatInvites,
    loadChatJoinRequests,
  } = getActions();

  const [isDeleteDialogOpen, openDeleteDialog, closeDeleteDialog] = useFlag();
  const currentTitle = chat.title;
  const currentAbout = chat.fullInfo ? (chat.fullInfo.about || '') : '';

  const [isProfileFieldsTouched, setIsProfileFieldsTouched] = useState(false);
  const [title, setTitle] = useState(currentTitle || '');
  const [about, setAbout] = useState(currentAbout);
  const [photo, setPhoto] = useState<File | undefined>();
  const [error, setError] = useState<string | undefined>();
  const imageHash = getChatAvatarHash(chat);
  const currentAvatarBlobUrl = useMedia(imageHash, false, ApiMediaFormat.BlobUrl);
  const isPublicGroup = chat.username || hasLinkedChannel;
  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  useEffect(() => {
    if (lastSyncTime && canInvite) {
      loadExportedChatInvites({ chatId });
      loadExportedChatInvites({ chatId, isRevoked: true });
      loadChatJoinRequests({ chatId });
    }
  }, [chatId, loadExportedChatInvites, lastSyncTime, canInvite, loadChatJoinRequests]);

  useEffect(() => {
    if (progress === ManagementProgress.Complete) {
      setIsProfileFieldsTouched(false);
      setError(undefined);
    }
  }, [progress]);

  const handleClickEditType = useCallback(() => {
    onScreenSelect(ManagementScreens.ChatPrivacyType);
  }, [onScreenSelect]);

  const handleClickDiscussion = useCallback(() => {
    onScreenSelect(ManagementScreens.Discussion);
  }, [onScreenSelect]);

  const handleClickReactions = useCallback(() => {
    onScreenSelect(ManagementScreens.Reactions);
  }, [onScreenSelect]);

  const handleClickPermissions = useCallback(() => {
    onScreenSelect(ManagementScreens.GroupPermissions);
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

  const handleUpdateGroup = useCallback(() => {
    const trimmedTitle = title.trim();
    const trimmedAbout = about.trim();

    if (!trimmedTitle.length) {
      setError(GROUP_TITLE_EMPTY);
      return;
    }

    updateChat({
      chatId,
      title: trimmedTitle,
      about: trimmedAbout,
      photo,
    });
  }, [about, chatId, photo, title, updateChat]);

  const handleClickMembers = useCallback(() => {
    onScreenSelect(ManagementScreens.GroupMembers);
  }, [onScreenSelect]);

  const handleTogglePreHistory = useCallback(() => {
    if (!chat.fullInfo) {
      return;
    }

    const { isPreHistoryHidden } = chat.fullInfo;

    togglePreHistoryHidden({ chatId: chat.id, isEnabled: !isPreHistoryHidden });
  }, [chat, togglePreHistoryHidden]);

  const enabledReactionsCount = chat.fullInfo?.enabledReactions?.length || 0;

  const enabledPermissionsCount = useMemo(() => {
    if (!chat.defaultBannedRights) {
      return 0;
    }

    let totalCount = [
      'sendMessages',
      'sendMedia',
      'embedLinks',
      'sendPolls',
      'changeInfo',
      'inviteUsers',
      'pinMessages',
    ].filter(
      (key) => !chat.defaultBannedRights![key as keyof ApiChatBannedRights],
    ).length;

    const { sendStickers, sendGifs } = chat.defaultBannedRights;

    // These two rights are controlled with a single checkbox
    if (!sendStickers && !sendGifs) {
      totalCount += 1;
    }

    return totalCount;
  }, [chat]);

  const adminsCount = (chat.fullInfo?.adminMembers?.length) || 0;

  const handleDeleteGroup = useCallback(() => {
    if (isBasicGroup) {
      deleteChat({ chatId: chat.id });
    } else if (!chat.isCreator) {
      leaveChannel({ chatId: chat.id });
    } else {
      deleteChannel({ chatId: chat.id });
    }
    closeDeleteDialog();
    closeManagement();
    openChat({ id: undefined });
  }, [
    isBasicGroup, chat.isCreator, chat.id,
    closeDeleteDialog, closeManagement, leaveChannel, deleteChannel, deleteChat, openChat,
  ]);

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
            id="group-title"
            label={lang('GroupName')}
            onChange={handleTitleChange}
            value={title}
            error={error === GROUP_TITLE_EMPTY ? error : undefined}
            disabled={!canChangeInfo}
          />
          <InputText
            id="group-about"
            className="mb-2"
            label={lang('DescriptionPlaceholder')}
            onChange={handleAboutChange}
            value={about}
            disabled={!canChangeInfo}
          />
          {chat.isCreator && (
            <ListItem icon="lock" multiline onClick={handleClickEditType}>
              <span className="title">{lang('GroupType')}</span>
              <span className="subtitle">{chat.username ? lang('TypePublic') : lang('TypePrivate')}</span>
            </ListItem>
          )}
          {hasLinkedChannel && (
            <ListItem
              icon="message"
              multiline
              onClick={handleClickDiscussion}
            >
              <span className="title">{lang('LinkedChannel')}</span>
              <span className="subtitle">{lang('DiscussionUnlink')}</span>
            </ListItem>
          )}
          <ListItem
            icon="permissions"
            multiline
            onClick={handleClickPermissions}
            disabled={!canBanUsers}
          >
            <span className="title">{lang('ChannelPermissions')}</span>
            <span className="subtitle" dir="auto">
              {enabledPermissionsCount}/{TOTAL_PERMISSIONS_COUNT}
            </span>
          </ListItem>

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
          <ListItem
            icon="admin"
            multiline
            onClick={handleClickAdministrators}
          >
            <span className="title">{lang('ChannelAdministrators')}</span>
            <span className="subtitle">{formatInteger(adminsCount)}</span>
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
              <span className="title">{lang('MemberRequests')}</span>
              <span className="subtitle">
                {formatInteger(chat.joinRequests!.length)}
              </span>
            </ListItem>
          )}
        </div>
        <div className="section">
          <ListItem icon="group" multiline onClick={handleClickMembers}>
            <span className="title">{lang('GroupMembers')}</span>
            <span className="subtitle">{formatInteger(chat.membersCount ?? 0)}</span>
          </ListItem>

          {!isPublicGroup && chat.fullInfo && (
            <div className="ListItem narrow no-selection">
              <Checkbox
                checked={!chat.fullInfo.isPreHistoryHidden}
                label={lang('ChatHistory')}
                onChange={handleTogglePreHistory}
                disabled={!canBanUsers}
              />
            </div>
          )}
        </div>
        <div className="section">
          <ListItem icon="delete" ripple destructive onClick={openDeleteDialog}>
            {lang('DeleteMega')}
          </ListItem>
        </div>
      </div>
      <FloatingActionButton
        isShown={isProfileFieldsTouched}
        onClick={handleUpdateGroup}
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
        textParts={renderText(
          isBasicGroup || !chat.isCreator
            ? lang('AreYouSureDeleteAndExit')
            : lang('AreYouSureDeleteThisChatWithGroup', chat.title),
          ['br', 'simple_markdown'],
        )}
        confirmLabel={isBasicGroup || !chat.isCreator ? lang('DeleteMega') : lang('DeleteGroupForAll')}
        confirmHandler={handleDeleteGroup}
        confirmIsDestructive
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId)!;
    const { progress } = global.management;
    const hasLinkedChannel = Boolean(chat.fullInfo?.linkedChatId);
    const isBasicGroup = isChatBasicGroup(chat);
    const { invites } = global.management.byChatId[chatId] || {};

    return {
      chat,
      progress,
      isBasicGroup,
      hasLinkedChannel,
      canChangeInfo: isBasicGroup ? chat.isCreator : getHasAdminRight(chat, 'changeInfo'),
      canBanUsers: isBasicGroup ? chat.isCreator : getHasAdminRight(chat, 'banUsers'),
      canInvite: isBasicGroup ? chat.isCreator : getHasAdminRight(chat, 'inviteUsers'),
      exportedInvites: invites,
      lastSyncTime: global.lastSyncTime,
      availableReactionsCount: global.availableReactions?.filter((l) => !l.isInactive).length,
    };
  },
)(ManageGroup));
