import type { ChangeEvent } from 'react';
import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiBotInfo, ApiUser } from '../../../api/types';
import { ApiMediaFormat } from '../../../api/types';
import { ManagementProgress } from '../../../types';

import { getChatAvatarHash, selectIsChatMuted } from '../../../global/helpers';
import {
  selectBot,
  selectChat,
  selectNotifyExceptions,
  selectNotifySettings,
  selectTabState,
  selectUserFullInfo,
} from '../../../global/selectors';
import { selectCurrentLimit } from '../../../global/selectors/limits';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useMedia from '../../../hooks/useMedia';

import AvatarEditable from '../../ui/AvatarEditable';
import Checkbox from '../../ui/Checkbox';
import FloatingActionButton from '../../ui/FloatingActionButton';
import InputText from '../../ui/InputText';
import SelectAvatar from '../../ui/SelectAvatar';
import Spinner from '../../ui/Spinner';
import TextArea from '../../ui/TextArea';

import './Management.scss';

type OwnProps = {
  userId: string;
  onClose: NoneToVoidFunction;
  isActive: boolean;
};

type StateProps = {
  userId?: string;
  user?: ApiUser;
  chatBot?: ApiBotInfo;
  currentBio?: string;
  progress?: ManagementProgress;
  isMuted?: boolean;
  maxBioLength: number;
  currentAvatarHash?: string;
};

const ERROR_FIRST_NAME_MISSING = 'Please provide first name';

const ManageBot: FC<OwnProps & StateProps> = ({
  userId,
  user,
  progress,
  isMuted,
  onClose,
  currentBio,
  isActive,
  maxBioLength,
  currentAvatarHash,
}) => {
  const {
    setBotInfo,
    uploadProfilePhoto,
    uploadContactProfilePhoto,
  } = getActions();

  const [isProfileFieldsTouched, setIsProfileFieldsTouched] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  const currentFirstName = user ? (user.firstName || '') : '';

  const [photo, setPhoto] = useState<File | undefined>();
  const [firstName, setFirstName] = useState(currentFirstName || '');
  const [bio, setBio] = useState(currentBio || '');
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(!isMuted);

  const currentAvatarBlobUrl = useMedia(currentAvatarHash, false, ApiMediaFormat.BlobUrl);

  useEffect(() => {
    setIsNotificationsEnabled(!isMuted);
  }, [isMuted]);

  useEffect(() => {
    setIsProfileFieldsTouched(false);
  }, [userId]);

  useEffect(() => {
    setFirstName(currentFirstName || '');
    setBio(currentBio || '');
  }, [currentFirstName, currentBio, user]);

  useEffect(() => {
    setPhoto(undefined);
  }, [currentAvatarBlobUrl]);

  useEffect(() => {
    if (progress === ManagementProgress.Complete) {
      setIsProfileFieldsTouched(false);
      setError(undefined);
    }
  }, [progress]);

  const handleFirstNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setFirstName(e.target.value);
    setIsProfileFieldsTouched(true);

    if (error === ERROR_FIRST_NAME_MISSING) {
      setError(undefined);
    }
  }, [error]);

  const handleBioChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setBio(e.target.value);
    setIsProfileFieldsTouched(true);
  }, []);

  const handlePhotoChange = useCallback((newPhoto: File) => {
    setPhoto(newPhoto);
    setIsProfileFieldsTouched(true);
  }, []);

  const handleNotificationChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setIsNotificationsEnabled(e.target.checked);
    setIsProfileFieldsTouched(true);
  }, []);

  const handleProfileSave = useCallback(() => {
    const trimmedFirstName = firstName.trim();
    const trimmedBio = bio.trim();

    if (!trimmedFirstName.length) {
      setError(ERROR_FIRST_NAME_MISSING);
      return;
    }

    setBotInfo({
      ...(isProfileFieldsTouched && {
        bot: user,
        name: trimmedFirstName,
        description: trimmedBio,
      }),
    });

    if (photo) {
      uploadProfilePhoto({
        file: photo,
        bot: user,
      });
    }
  }, [firstName, bio, photo, isProfileFieldsTouched, user]);

  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null);
  const isSuggestRef = useRef(false);

  const handleSelectAvatar = useCallback((file: File) => {
    setIsProfileFieldsTouched(true);
    uploadContactProfilePhoto({ userId, file, isSuggest: isSuggestRef.current });
  }, [uploadContactProfilePhoto, userId]);

  if (!user) {
    return undefined;
  }

  const isLoading = progress === ManagementProgress.InProgress;

  return (
    <div className="Management">
      <div className="custom-scroll">
        <div className="section">
          <AvatarEditable
            currentAvatarBlobUrl={currentAvatarBlobUrl}
            onChange={handlePhotoChange}
            title="Edit your profile photo"
            disabled={isLoading}
          />
          <InputText
            id="user-first-name"
            label={lang('UserInfo.FirstNamePlaceholder')}
            onChange={handleFirstNameChange}
            value={firstName}
            error={error === ERROR_FIRST_NAME_MISSING ? error : undefined}
          />
          <TextArea
            value={bio}
            onChange={handleBioChange}
            label={lang('DescriptionPlaceholder')}
            disabled={isLoading}
            maxLength={maxBioLength}
            maxLengthIndicator={maxBioLength ? (maxBioLength - bio.length).toString() : undefined}
          />
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
        <div className="section">
          {/* bot commands section */}
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
          <i className="icon icon-check" />
        )}
      </FloatingActionButton>
      <SelectAvatar
        onChange={handleSelectAvatar}
        inputRef={inputRef}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { userId }): StateProps => {
    const user = selectBot(global, userId);
    const chat = selectChat(global, userId);
    const userFullInfo = selectUserFullInfo(global, userId);
    const { progress } = selectTabState(global).management;
    const isMuted = chat && selectIsChatMuted(chat, selectNotifySettings(global), selectNotifyExceptions(global));
    const maxBioLength = selectCurrentLimit(global, 'aboutLength');

    let currentAvatarHash;
    if (user) {
      currentAvatarHash = getChatAvatarHash(user);
    }

    return {
      userId,
      user,
      progress,
      isMuted,
      currentBio: userFullInfo?.bio,
      maxBioLength,
      currentAvatarHash,
    };
  },
)(ManageBot));
