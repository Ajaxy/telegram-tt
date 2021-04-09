import { ChangeEvent } from 'react';
import React, {
  FC, memo, useCallback, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { ManagementScreens, ManagementProgress } from '../../../types';
import { ApiChat, ApiChatBannedRights, ApiMediaFormat } from '../../../api/types';
import { GlobalActions } from '../../../global/types';

import { getChatAvatarHash, isChatBasicGroup } from '../../../modules/helpers';
import useMedia from '../../../hooks/useMedia';
import useLang from '../../../hooks/useLang';
import useFlag from '../../../hooks/useFlag';
import { selectChat } from '../../../modules/selectors';
import { formatInteger } from '../../../util/textFormat';
import { pick } from '../../../util/iteratees';
import renderText from '../../common/helpers/renderText';

import AvatarEditable from '../../ui/AvatarEditable';
import InputText from '../../ui/InputText';
import ListItem from '../../ui/ListItem';
import Checkbox from '../../ui/Checkbox';
import Spinner from '../../ui/Spinner';
import FloatingActionButton from '../../ui/FloatingActionButton';
import ConfirmDialog from '../../ui/ConfirmDialog';

import './Management.scss';

type OwnProps = {
  chatId: number;
  onScreenSelect: (screen: ManagementScreens) => void;
};

type StateProps = {
  chat: ApiChat;
  progress?: ManagementProgress;
  isBasicGroup: boolean;
  hasLinkedChannel: boolean;
};

type DispatchProps = Pick<GlobalActions, (
  'togglePreHistoryHidden' | 'updateChat' | 'closeManagement' |
  'deleteHistory' | 'leaveChannel' | 'deleteChannel' | 'openChat'
)>;

const GROUP_TITLE_EMPTY = 'Group title can\'t be empty';

// Some checkboxes control multiple rights, and some rights are not controlled from Permissions screen,
// so we need to define the amount manually
const TOTAL_PERMISSIONS_COUNT = 8;

const ManageGroup: FC<OwnProps & StateProps & DispatchProps> = ({
  chatId,
  chat,
  progress,
  isBasicGroup,
  hasLinkedChannel,
  onScreenSelect,
  togglePreHistoryHidden,
  updateChat,
  deleteHistory,
  leaveChannel,
  deleteChannel,
  closeManagement,
  openChat,
}) => {
  const [isDeleteDialogOpen, openDeleteDialog, closeDeleteDialog] = useFlag();
  const currentTitle = chat.title;
  const currentAbout = chat.fullInfo ? (chat.fullInfo.about || '') : '';

  const [isProfileFieldsTouched, setIsProfileFieldsTouched] = useState(false);
  const [title, setTitle] = useState(currentTitle);
  const [about, setAbout] = useState(currentAbout);
  const [photo, setPhoto] = useState<File | undefined>();
  const [error, setError] = useState<string | undefined>();
  const imageHash = getChatAvatarHash(chat);
  const currentAvatarBlobUrl = useMedia(imageHash, false, ApiMediaFormat.BlobUrl);
  const lang = useLang();

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

  const handleClickPermissions = useCallback(() => {
    onScreenSelect(ManagementScreens.GroupPermissions);
  }, [onScreenSelect]);

  const handleClickAdministrators = useCallback(() => {
    onScreenSelect(ManagementScreens.ChatAdministrators);
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

  const adminsCount = (chat.fullInfo && chat.fullInfo.adminMembers && chat.fullInfo.adminMembers.length) || 0;

  const handleDeleteGroup = useCallback(() => {
    if (isBasicGroup) {
      deleteHistory({ chatId: chat.id, maxId: chat.lastMessage!.id, shouldDeleteForAll: false });
    } else if (!chat.isCreator) {
      leaveChannel({ chatId: chat.id });
    } else {
      deleteChannel({ chatId: chat.id });
    }
    closeDeleteDialog();
    closeManagement();
    openChat({ id: undefined });
  }, [
    isBasicGroup, chat.isCreator, chat.id, chat.lastMessage,
    closeDeleteDialog, closeManagement, deleteHistory, leaveChannel, deleteChannel, openChat,
  ]);

  if (chat.isRestricted) {
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
          />
          <InputText
            id="group-title"
            label={lang('GroupName')}
            onChange={handleTitleChange}
            value={title}
            error={error === GROUP_TITLE_EMPTY ? error : undefined}
          />
          <InputText
            id="group-about"
            className="mb-2"
            label={lang('DescriptionPlaceholder')}
            onChange={handleAboutChange}
            value={about}
          />
          {chat.isCreator && (
            <ListItem icon="lock" ripple onClick={handleClickEditType}>
              <div className="multiline-item">
                <span className="title">{lang('GroupType')}</span>
                <span className="subtitle">{chat.username ? lang('TypePublic') : lang('TypePrivate')}</span>
              </div>
            </ListItem>
          )}
          {hasLinkedChannel && (
            <ListItem icon="message" ripple onClick={handleClickDiscussion}>
              <div className="multiline-item">
                <span className="title">{lang('LinkedChannel')}</span>
                <span className="subtitle">{lang('DiscussionUnlink')}</span>
              </div>
            </ListItem>
          )}
          <ListItem icon="permissions" ripple onClick={handleClickPermissions}>
            <div className="multiline-item">
              <span className="title">{lang('ChannelPermissions')}</span>
              <span className="subtitle">{enabledPermissionsCount}/{TOTAL_PERMISSIONS_COUNT}</span>
            </div>
          </ListItem>
          <ListItem icon="admin" ripple onClick={handleClickAdministrators}>
            <div className="multiline-item">
              <span className="title">{lang('ChannelAdministrators')}</span>
              <span className="subtitle">{formatInteger(adminsCount)}</span>
            </div>
          </ListItem>
        </div>
        <div className="section">
          <ListItem icon="group" ripple onClick={handleClickMembers}>
            <div className="multiline-item">
              <span className="title">{lang('GroupMembers')}</span>
              <span className="subtitle">{formatInteger(chat.membersCount!)}</span>
            </div>
          </ListItem>

          {chat.fullInfo && (
            <div className="ListItem narrow no-selection">
              <Checkbox
                checked={!chat.fullInfo.isPreHistoryHidden}
                label={lang('ChatHistory')}
                onChange={handleTogglePreHistory}
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
    const hasLinkedChannel = Boolean(chat.fullInfo && chat.fullInfo.linkedChatId);

    return {
      chat,
      progress,
      isBasicGroup: isChatBasicGroup(chat),
      hasLinkedChannel,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'togglePreHistoryHidden', 'updateChat', 'closeManagement',
    'deleteHistory', 'leaveChannel', 'deleteChannel', 'openChat',
  ]),
)(ManageGroup));
