import type { ChangeEvent } from 'react';
import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiUser } from '../../../api/types';
import { ManagementProgress } from '../../../types';

import { SERVICE_NOTIFICATIONS_USER_ID } from '../../../config';
import {
  selectChat, selectNotifyExceptions, selectNotifySettings, selectUser,
} from '../../../global/selectors';
import { isUserBot, selectIsChatMuted } from '../../../global/helpers';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useHistoryBack from '../../../hooks/useHistoryBack';

import InputText from '../../ui/InputText';
import ListItem from '../../ui/ListItem';
import Checkbox from '../../ui/Checkbox';
import FloatingActionButton from '../../ui/FloatingActionButton';
import Spinner from '../../ui/Spinner';
import PrivateChatInfo from '../../common/PrivateChatInfo';
import ConfirmDialog from '../../ui/ConfirmDialog';
import SelectAvatar from '../../ui/SelectAvatar';
import Avatar from '../../common/Avatar';

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
};

const ERROR_FIRST_NAME_MISSING = 'Please provide first name';

const ManageUser: FC<OwnProps & StateProps> = ({
  userId,
  user,
  progress,
  isMuted,
  onClose,
  isActive,
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
  const lang = useLang();

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
  }, []);

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
  const personalPhoto = user.fullInfo?.personalPhoto;
  const notPersonalPhoto = user.fullInfo?.profilePhoto || user.fullInfo?.fallbackPhoto;

  return (
    <div className="Management">
      <div className="custom-scroll">
        <div className="section">
          <PrivateChatInfo
            userId={user.id}
            avatarSize="jumbo"
            status="original name"
            withFullInfo
          />
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
          <div className="ListItem no-selection narrow">
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
              {lang('UserInfo.SuggestPhoto', user.firstName)}
            </ListItem>
            <ListItem icon="camera-add" ripple onClick={handleSetPersonalPhoto}>
              {lang('UserInfo.SetCustomPhoto', user.firstName)}
            </ListItem>
            {personalPhoto && (
              <ListItem
                leftElement={(
                  <Avatar
                    photo={notPersonalPhoto}
                    noPersonalPhoto
                    user={user}
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
            <p className="text-muted" dir="auto">{lang('UserInfo.CustomPhotoInfo', user.firstName)}</p>
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
          <i className="icon-check" />
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
    const chat = selectChat(global, userId)!;
    const { progress } = global.management;
    const isMuted = selectIsChatMuted(chat, selectNotifySettings(global), selectNotifyExceptions(global));

    return {
      user, progress, isMuted,
    };
  },
)(ManageUser));
