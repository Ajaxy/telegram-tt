import type { ChangeEvent } from 'react';
import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiPhoto, ApiUser } from '../../../api/types';
import { ManagementProgress } from '../../../types';

import { SERVICE_NOTIFICATIONS_USER_ID } from '../../../config';
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

import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useOldLang from '../../../hooks/useOldLang';

import Avatar from '../../common/Avatar';
import Icon from '../../common/icons/Icon';
import PrivateChatInfo from '../../common/PrivateChatInfo';
import Checkbox from '../../ui/Checkbox';
import ConfirmDialog from '../../ui/ConfirmDialog';
import FloatingActionButton from '../../ui/FloatingActionButton';
import InputText from '../../ui/InputText';
import ListItem from '../../ui/ListItem';
import SelectAvatar from '../../ui/SelectAvatar';
import Spinner from '../../ui/Spinner';

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
}) => {
  const {
    updateContact,
    deleteContact,
    closeManagement,
    uploadContactProfilePhoto,
  } = getActions();

  const [isDeleteDialogOpen, openDeleteDialog, closeDeleteDialog] = useFlag();
  const [isResetPersonalPhotoDialogOpen, openResetPersonalPhotoDialog, closeResetPersonalPhotoDialog] = useFlag();
  const [isProfileFieldsTouched, setIsProfileFieldsTouched] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const lang = useOldLang();

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  const currentFirstName = user ? (user.firstName || '') : '';
  const currentLastName = user ? (user.lastName || '') : '';

  const [firstName, setFirstName] = useState(currentFirstName);
  const [lastName, setLastName] = useState(currentLastName);
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(!isMuted);

  useEffect(() => {
    setIsNotificationsEnabled(!isMuted);
  }, [isMuted]);

  useEffect(() => {
    setIsProfileFieldsTouched(false);
    closeDeleteDialog();
  }, [closeDeleteDialog, userId]);

  useEffect(() => {
    setFirstName(currentFirstName);
    setLastName(currentLastName);
  }, [currentFirstName, currentLastName, user]);

  useEffect(() => {
    if (progress === ManagementProgress.Complete) {
      setIsProfileFieldsTouched(false);
      setError(undefined);
      closeDeleteDialog();
    }
  }, [closeDeleteDialog, progress]);

  const handleFirstNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setFirstName(e.target.value);
    setIsProfileFieldsTouched(true);

    if (error === ERROR_FIRST_NAME_MISSING) {
      setError(undefined);
    }
  }, [error]);

  const handleLastNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setLastName(e.target.value);
    setIsProfileFieldsTouched(true);
  }, []);

  const handleNotificationChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setIsNotificationsEnabled(e.target.checked);
    setIsProfileFieldsTouched(true);
  }, []);

  const handleProfileSave = useCallback(() => {
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    if (!trimmedFirstName.length) {
      setError(ERROR_FIRST_NAME_MISSING);
      return;
    }

    updateContact({
      userId,
      isMuted: !isNotificationsEnabled,
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
    });
  }, [firstName, lastName, updateContact, userId, isNotificationsEnabled]);

  const handleDeleteContact = useCallback(() => {
    deleteContact({ userId });
    closeDeleteDialog();
    closeManagement();
  }, [closeDeleteDialog, closeManagement, deleteContact, userId]);

  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null);
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
    setIsProfileFieldsTouched(true);
    uploadContactProfilePhoto({ userId });
  }, [closeResetPersonalPhotoDialog, uploadContactProfilePhoto, userId]);

  const handleSelectAvatar = useCallback((file: File) => {
    setIsProfileFieldsTouched(true);
    uploadContactProfilePhoto({ userId, file, isSuggest: isSuggestRef.current });
  }, [uploadContactProfilePhoto, userId]);

  if (!user) {
    return undefined;
  }

  const canSetPersonalPhoto = !isUserBot(user) && user.id !== SERVICE_NOTIFICATIONS_USER_ID;
  const isLoading = progress === ManagementProgress.InProgress;

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
              id="user-first-name"
              label={lang('UserInfo.FirstNamePlaceholder')}
              onChange={handleFirstNameChange}
              value={firstName}
              error={error === ERROR_FIRST_NAME_MISSING ? error : undefined}
            />
            <InputText
              id="user-last-name"
              label={lang('UserInfo.LastNamePlaceholder')}
              onChange={handleLastNameChange}
              value={lastName}
            />
          </div>
          <div className="ListItem narrow">
            <Checkbox
              checked={isNotificationsEnabled}
              label={lang('Notifications')}
              subLabel={lang(isNotificationsEnabled
                ? 'UserInfo.NotificationsEnabled'
                : 'UserInfo.NotificationsDisabled')}
              onChange={handleNotificationChange}
            />
          </div>
        </div>
        {canSetPersonalPhoto && (
          <div className="section">
            <ListItem icon="camera-add" ripple onClick={handleSuggestPhoto}>
              <span className="list-item-ellipsis">{lang('UserInfo.SuggestPhoto', user.firstName)}</span>
            </ListItem>
            <ListItem icon="camera-add" ripple onClick={handleSetPersonalPhoto}>
              <span className="list-item-ellipsis">{lang('UserInfo.SetCustomPhoto', user.firstName)}</span>
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
                {lang('UserInfo.ResetCustomPhoto')}
              </ListItem>
            )}
            <p className="section-help" dir="auto">{lang('UserInfo.CustomPhotoInfo', user.firstName)}</p>
          </div>
        )}
        <div className="section">
          <ListItem icon="delete" ripple destructive onClick={openDeleteDialog}>
            {lang('DeleteContact')}
          </ListItem>
        </div>
      </div>
      <FloatingActionButton
        isShown={isProfileFieldsTouched}
        onClick={handleProfileSave}
        disabled={isLoading}
        ariaLabel={lang('Save')}
      >
        {isLoading ? (
          <Spinner color="white" />
        ) : (
          <Icon name="check" />
        )}
      </FloatingActionButton>
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={closeDeleteDialog}
        text={lang('AreYouSureDeleteContact')}
        confirmLabel={lang('DeleteContact')}
        confirmHandler={handleDeleteContact}
        confirmIsDestructive
      />
      <ConfirmDialog
        isOpen={isResetPersonalPhotoDialogOpen}
        onClose={closeResetPersonalPhotoDialog}
        text={lang('UserInfo.ResetToOriginalAlertText', user.firstName)}
        confirmLabel={lang('Reset')}
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
  (global, { userId }): StateProps => {
    const user = selectUser(global, userId);
    const chat = selectChat(global, userId);
    const userFullInfo = selectUserFullInfo(global, userId);
    const { progress } = selectTabState(global).management;
    const isMuted = chat && getIsChatMuted(chat, selectNotifyDefaults(global), selectNotifyException(global, chat.id));
    const personalPhoto = userFullInfo?.personalPhoto;
    const notPersonalPhoto = userFullInfo?.profilePhoto || userFullInfo?.fallbackPhoto;

    return {
      user, progress, isMuted, personalPhoto, notPersonalPhoto,
    };
  },
)(ManageUser));
