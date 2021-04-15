import { ChangeEvent } from 'react';
import React, {
  FC, memo, useCallback, useEffect, useState,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import { ManagementScreens, ManagementProgress } from '../../../types';
import { ApiChat, ApiMediaFormat } from '../../../api/types';

import { pick } from '../../../util/iteratees';
import { getChatAvatarHash, getHasAdminRight } from '../../../modules/helpers';
import useMedia from '../../../hooks/useMedia';
import useLang from '../../../hooks/useLang';
import { selectChat } from '../../../modules/selectors';

import AvatarEditable from '../../ui/AvatarEditable';
import InputText from '../../ui/InputText';
import ListItem from '../../ui/ListItem';
import Checkbox from '../../ui/Checkbox';
import Spinner from '../../ui/Spinner';
import FloatingActionButton from '../../ui/FloatingActionButton';
import ConfirmDialog from '../../ui/ConfirmDialog';
import useFlag from '../../../hooks/useFlag';

import './Management.scss';

type OwnProps = {
  chatId: number;
  onScreenSelect: (screen: ManagementScreens) => void;
};

type StateProps = {
  chat: ApiChat;
  progress?: ManagementProgress;
  isSignaturesShown: boolean;
  canChangeInfo?: boolean;
};

type DispatchProps = Pick<GlobalActions, (
  'toggleSignatures' | 'updateChat' | 'closeManagement' | 'leaveChannel' | 'deleteChannel' | 'openChat'
)>;

const CHANNEL_TITLE_EMPTY = 'Channel title can\'t be empty';

const ManageChannel: FC<OwnProps & StateProps & DispatchProps> = ({
  chatId,
  chat,
  progress,
  isSignaturesShown,
  canChangeInfo,
  onScreenSelect,
  updateChat,
  toggleSignatures,
  closeManagement,
  leaveChannel,
  deleteChannel,
  openChat,
}) => {
  const currentTitle = chat ? (chat.title || '') : '';
  const currentAbout = chat && chat.fullInfo ? (chat.fullInfo.about || '') : '';
  const hasLinkedChat = chat && chat.fullInfo && chat.fullInfo.linkedChatId;

  const [isDeleteDialogOpen, openDeleteDialog, closeDeleteDialog] = useFlag();
  const [isProfileFieldsTouched, setIsProfileFieldsTouched] = useState(false);
  const [title, setTitle] = useState(currentTitle);
  const [about, setAbout] = useState(currentAbout);
  const [photo, setPhoto] = useState<File | undefined>();
  const [error, setError] = useState<string | undefined>();
  const imageHash = chat && getChatAvatarHash(chat);
  const currentAvatarBlobUrl = useMedia(imageHash, false, ApiMediaFormat.BlobUrl);
  const lang = useLang();

  useEffect(() => {
    if (progress === ManagementProgress.Complete) {
      setIsProfileFieldsTouched(false);
      setError(undefined);
    }
  }, [progress]);

  const adminsCount = (chat && chat.fullInfo && chat.fullInfo.adminMembers && chat.fullInfo.adminMembers.length) || 0;

  const handleClickEditType = useCallback(() => {
    onScreenSelect(ManagementScreens.ChatPrivacyType);
  }, [onScreenSelect]);

  const handleClickDiscussion = useCallback(() => {
    onScreenSelect(ManagementScreens.Discussion);
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
            <ListItem icon="lock" ripple onClick={handleClickEditType}>
              <div className="multiline-item">
                <span className="title">{lang('ChannelType')}</span>
                <span className="subtitle">{chat.username ? lang('TypePublic') : lang('TypePrivate')}</span>
              </div>
            </ListItem>
          )}
          <ListItem icon="message" ripple onClick={handleClickDiscussion} disabled={!canChangeInfo}>
            <div className="multiline-item">
              <span className="title">{lang('Discussion')}</span>
              <span className="subtitle">{hasLinkedChat ? lang('DiscussionUnlink') : lang('Add')}</span>
            </div>
          </ListItem>
          <ListItem icon="admin" ripple onClick={handleClickAdministrators}>
            <div className="multiline-item">
              <span className="title">{lang('ChannelAdministrators')}</span>
              <span className="subtitle">{adminsCount}</span>
            </div>
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
          <ListItem icon="group" ripple onClick={handleClickSubscribers}>
            <div className="multiline-item">
              <span className="title">{lang('ChannelSubscribers')}</span>
              <span className="subtitle">{lang('Subscribers', chat.membersCount!, 'i')}</span>
            </div>
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
    const isSignaturesShown = Boolean(chat && chat.isSignaturesShown);

    return {
      chat,
      progress,
      isSignaturesShown,
      canChangeInfo: getHasAdminRight(chat, 'changeInfo'),
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'toggleSignatures', 'updateChat', 'closeManagement', 'leaveChannel', 'deleteChannel', 'openChat',
  ]),
)(ManageChannel));
