import type { ChangeEvent } from 'react';
import type { FC } from '../../../lib/teact/teact';
import {
  memo, useCallback, useEffect, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiPhoto, ApiUser } from '../../../api/types';
import { ManagementProgress } from '../../../types';

import { MUTE_INDEFINITE_TIMESTAMP, SERVICE_NOTIFICATIONS_USER_ID, UNMUTE_TIMESTAMP } from '../../../config';
import { isUserBot } from '../../../global/helpers';
import { getIsChatMuted } from '../../../global/helpers/notifications';
import {
  selectChat,
  selectNotifyDefaults,
  selectNotifyException,
  selectTabState,
  selectUser,
  selectUserFullInfo,
} from '../../../global/selectors';
import { DEFAULT_MAX_NOTE_LENGTH } from '../../../limits';

import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useOldLang from '../../../hooks/useOldLang';

import Avatar from '../../common/Avatar';
import PrivateChatInfo from '../../common/PrivateChatInfo';
import Checkbox from '../../ui/Checkbox';
import ConfirmDialog from '../../ui/ConfirmDialog';
import FloatingActionButton from '../../ui/FloatingActionButton';
import InputText from '../../ui/InputText';
import ListItem from '../../ui/ListItem';
import SelectAvatar from '../../ui/SelectAvatar';
import TextArea from '../../ui/TextArea';

import './Management.scss';

type OwnProps = {
  userId: string;
  onClose: NoneToVoidFunction;
  isActive: boolean;
};

type StateProps = {
  user?: ApiUser;
  progress?: ManagementProgress;
  isMuted?: boolean;
  personalPhoto?: ApiPhoto;
  notPersonalPhoto?: ApiPhoto;
  noteText?: string;
  contactNoteLimit: number;
};

const ERROR_FIRST_NAME_MISSING = 'Please provide first name';

const ManageUser: FC<OwnProps & StateProps> = ({
  userId,
  user,
  progress,
  isMuted,
  onClose,
  isActive,
  personalPhoto,
  notPersonalPhoto,
  noteText,
  contactNoteLimit,
}) => {
  const {
    updateContact,
    updateContactNote,
    deleteContact,
    closeManagement,
    uploadContactProfilePhoto,
    updateChatMutedState,
  } = getActions();

  const [isDeleteDialogOpen, openDeleteDialog, closeDeleteDialog] = useFlag();
  const [isResetPersonalPhotoDialogOpen, openResetPersonalPhotoDialog, closeResetPersonalPhotoDialog] = useFlag();
  const [isProfileFieldsTouched, markProfileFieldsTouched, unmarkProfileFieldsTouched] = useFlag();
  const [error, setError] = useState<string | undefined>();
  const [isNotificationsTouched, markNotificationsTouched, unmarkNotificationsTouched] = useFlag();
  const oldLang = useOldLang();
  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  const currentFirstName = user ? (user.firstName || '') : '';
  const currentLastName = user ? (user.lastName || '') : '';
  const currentNote = noteText || '';

  const [firstName, setFirstName] = useState(currentFirstName);
  const [lastName, setLastName] = useState(currentLastName);
  const [note, setNote] = useState(currentNote);
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(!isMuted);

  useEffect(() => {
    setIsNotificationsEnabled(!isMuted);
  }, [isMuted]);

  useEffect(() => {
    unmarkProfileFieldsTouched();
    unmarkNotificationsTouched();
    closeDeleteDialog();
  }, [closeDeleteDialog, userId]);

  useEffect(() => {
    setFirstName(currentFirstName);
    setLastName(currentLastName);
    setNote(currentNote);
  }, [currentFirstName, currentLastName, currentNote]);

  useEffect(() => {
    if (progress === ManagementProgress.Complete) {
      unmarkProfileFieldsTouched();
      setError(undefined);
      closeDeleteDialog();
    }
  }, [closeDeleteDialog, progress]);

  const handleFirstNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setFirstName(e.target.value);
    markProfileFieldsTouched();

    if (error === ERROR_FIRST_NAME_MISSING) {
      setError(undefined);
    }
  }, [error]);

  const handleLastNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setLastName(e.target.value);
    markProfileFieldsTouched();
  }, []);

  const handleNoteChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setNote(e.target.value);
    markProfileFieldsTouched();
  }, []);

  const handleNotificationChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setIsNotificationsEnabled(e.target.checked);
    markNotificationsTouched();
    markProfileFieldsTouched();
  }, []);

  const handleProfileSave = useCallback(() => {
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedNote = note.trim();

    if (!trimmedFirstName.length) {
      setError(ERROR_FIRST_NAME_MISSING);
      return;
    }

    firstNameRef.current?.blur();
    lastNameRef.current?.blur();
    noteRef.current?.blur();

    updateContact({
      userId,
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
    });

    if (trimmedNote !== currentNote) {
      updateContactNote({
        userId,
        note: { text: trimmedNote, entities: [] },
      });
    }

    if (isNotificationsTouched) {
      updateChatMutedState({
        chatId: userId, mutedUntil: isNotificationsEnabled ? UNMUTE_TIMESTAMP : MUTE_INDEFINITE_TIMESTAMP,
      });
    }
  }, [currentNote, firstName, isNotificationsEnabled, isNotificationsTouched, lastName, note, userId]);

  const handleDeleteContact = useCallback(() => {
    deleteContact({ userId });
    closeDeleteDialog();
    closeManagement();
  }, [closeDeleteDialog, closeManagement, deleteContact, userId]);

  const firstNameRef = useRef<HTMLInputElement>();
  const lastNameRef = useRef<HTMLInputElement>();
  const noteRef = useRef<HTMLTextAreaElement>();

  const inputRef = useRef<HTMLInputElement>();
  const isSuggestRef = useRef(false);

  const handleSuggestPhoto = useCallback(() => {
    inputRef.current?.click();
    isSuggestRef.current = true;
  }, []);

  const handleSetPersonalPhoto = useCallback(() => {
    inputRef.current?.click();
    isSuggestRef.current = false;
  }, []);

  const handleResetPersonalAvatar = useCallback(() => {
    closeResetPersonalPhotoDialog();
    markProfileFieldsTouched();
    uploadContactProfilePhoto({ userId });
  }, [closeResetPersonalPhotoDialog, uploadContactProfilePhoto, userId]);

  const handleSelectAvatar = useCallback((file: File) => {
    markProfileFieldsTouched();
    uploadContactProfilePhoto({ userId, file, isSuggest: isSuggestRef.current });
  }, [uploadContactProfilePhoto, userId]);

  if (!user) {
    return undefined;
  }

  const canSetPersonalPhoto = !isUserBot(user) && user.id !== SERVICE_NOTIFICATIONS_USER_ID;
  const isLoading = progress === ManagementProgress.InProgress;
  const noteSymbolsLeft = contactNoteLimit - note.length;

  return (
    <div className="Management">
      <div className="custom-scroll">
        <div className="section">
          <PrivateChatInfo
            userId={user.id}
            avatarSize="jumbo"
            noStatusOrTyping
            noEmojiStatus
            withFullInfo
          />
          <div className="settings-edit">
            <InputText
              ref={firstNameRef}
              id="user-first-name"
              label={oldLang('UserInfo.FirstNamePlaceholder')}
              onChange={handleFirstNameChange}
              value={firstName}
              error={error === ERROR_FIRST_NAME_MISSING ? error : undefined}
            />
            <InputText
              ref={lastNameRef}
              id="user-last-name"
              label={oldLang('UserInfo.LastNamePlaceholder')}
              onChange={handleLastNameChange}
              value={lastName}
            />
            <TextArea
              ref={noteRef}
              id="user-note"
              label={lang('UserNoteTitle')}
              onChange={handleNoteChange}
              value={note}
              maxLength={contactNoteLimit}
              maxLengthIndicator={noteSymbolsLeft.toString()}
              noReplaceNewlines
            />
          </div>
          <p className="section-edit-info" dir="auto">{lang('EditUserNoteHint')}</p>
          <div className="ListItem narrow">
            <Checkbox
              checked={isNotificationsEnabled}
              label={oldLang('Notifications')}
              subLabel={oldLang(isNotificationsEnabled
                ? 'UserInfo.NotificationsEnabled'
                : 'UserInfo.NotificationsDisabled')}
              onChange={handleNotificationChange}
            />
          </div>
        </div>
        {canSetPersonalPhoto && (
          <div className="section">
            <ListItem icon="camera-add" ripple onClick={handleSuggestPhoto}>
              <span className="list-item-ellipsis">{oldLang('UserInfo.SuggestPhoto', user.firstName)}</span>
            </ListItem>
            <ListItem icon="camera-add" ripple onClick={handleSetPersonalPhoto}>
              <span className="list-item-ellipsis">{oldLang('UserInfo.SetCustomPhoto', user.firstName)}</span>
            </ListItem>
            {personalPhoto && (
              <ListItem
                leftElement={(
                  <Avatar
                    photo={notPersonalPhoto}
                    noPersonalPhoto
                    peer={user}
                    size="mini"
                    className="personal-photo"
                  />
                )}
                ripple
                onClick={openResetPersonalPhotoDialog}
              >
                {oldLang('UserInfo.ResetCustomPhoto')}
              </ListItem>
            )}
            <p className="section-help" dir="auto">{oldLang('UserInfo.CustomPhotoInfo', user.firstName)}</p>
          </div>
        )}
        <div className="section">
          <ListItem icon="delete" ripple destructive onClick={openDeleteDialog}>
            {oldLang('DeleteContact')}
          </ListItem>
        </div>
      </div>
      <FloatingActionButton
        isShown={isProfileFieldsTouched}
        onClick={handleProfileSave}
        disabled={isLoading}
        ariaLabel={oldLang('Save')}
        iconName="check"
        isLoading={isLoading}
      />
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={closeDeleteDialog}
        text={oldLang('AreYouSureDeleteContact')}
        confirmLabel={oldLang('DeleteContact')}
        confirmHandler={handleDeleteContact}
        confirmIsDestructive
      />
      <ConfirmDialog
        isOpen={isResetPersonalPhotoDialogOpen}
        onClose={closeResetPersonalPhotoDialog}
        text={oldLang('UserInfo.ResetToOriginalAlertText', user.firstName)}
        confirmLabel={oldLang('Reset')}
        confirmHandler={handleResetPersonalAvatar}
        confirmIsDestructive
      />
      <SelectAvatar
        onChange={handleSelectAvatar}
        inputRef={inputRef}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { userId }): Complete<StateProps> => {
    const user = selectUser(global, userId);
    const chat = selectChat(global, userId);
    const userFullInfo = selectUserFullInfo(global, userId);
    const { progress } = selectTabState(global).management;
    const isMuted = chat && getIsChatMuted(chat, selectNotifyDefaults(global), selectNotifyException(global, chat.id));
    const personalPhoto = userFullInfo?.personalPhoto;
    const notPersonalPhoto = userFullInfo?.profilePhoto || userFullInfo?.fallbackPhoto;
    const noteText = userFullInfo?.note?.text;
    const contactNoteLimit = global.appConfig?.contactNoteLimit || DEFAULT_MAX_NOTE_LENGTH;

    return {
      user, progress, isMuted, personalPhoto, notPersonalPhoto, noteText, contactNoteLimit,
    };
  },
)(ManageUser));
