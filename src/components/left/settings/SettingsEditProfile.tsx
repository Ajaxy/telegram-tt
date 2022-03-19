import { ChangeEvent } from 'react';
import React, {
  FC, useState, useCallback, memo, useEffect, useMemo,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../modules';

import { ApiMediaFormat } from '../../../api/types';
import { ProfileEditProgress, SettingsScreens } from '../../../types';

import { throttle } from '../../../util/schedulers';
import { selectUser } from '../../../modules/selectors';
import { getChatAvatarHash } from '../../../modules/helpers';
import useMedia from '../../../hooks/useMedia';
import useLang from '../../../hooks/useLang';

import AvatarEditable from '../../ui/AvatarEditable';
import FloatingActionButton from '../../ui/FloatingActionButton';
import Spinner from '../../ui/Spinner';
import InputText from '../../ui/InputText';
import renderText from '../../common/helpers/renderText';
import UsernameInput from '../../common/UsernameInput';
import useHistoryBack from '../../../hooks/useHistoryBack';

type OwnProps = {
  isActive: boolean;
  onScreenSelect: (screen: SettingsScreens) => void;
  onReset: () => void;
};

type StateProps = {
  currentAvatarHash?: string;
  currentFirstName?: string;
  currentLastName?: string;
  currentBio?: string;
  currentUsername?: string;
  progress?: ProfileEditProgress;
  isUsernameAvailable?: boolean;
};

const runThrottled = throttle((cb) => cb(), 60000, true);

const MAX_BIO_LENGTH = 70;

const ERROR_FIRST_NAME_MISSING = 'Please provide your first name';
const ERROR_BIO_TOO_LONG = 'Bio can\' be longer than 70 characters';

const SettingsEditProfile: FC<OwnProps & StateProps> = ({
  isActive,
  onScreenSelect,
  onReset,
  currentAvatarHash,
  currentFirstName,
  currentLastName,
  currentBio,
  currentUsername,
  progress,
  isUsernameAvailable,
}) => {
  const {
    loadCurrentUser,
    updateProfile,
    checkUsername,
  } = getActions();

  const lang = useLang();

  const [isUsernameTouched, setIsUsernameTouched] = useState(false);
  const [isProfileFieldsTouched, setIsProfileFieldsTouched] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const [photo, setPhoto] = useState<File | undefined>();
  const [firstName, setFirstName] = useState(currentFirstName || '');
  const [lastName, setLastName] = useState(currentLastName || '');
  const [bio, setBio] = useState(currentBio || '');
  const [username, setUsername] = useState<string | false>(currentUsername || '');

  const currentAvatarBlobUrl = useMedia(currentAvatarHash, false, ApiMediaFormat.BlobUrl);

  const isLoading = progress === ProfileEditProgress.InProgress;
  const isUsernameError = username === false;

  const isSaveButtonShown = useMemo(() => {
    if (isUsernameError) {
      return false;
    }

    return Boolean(photo) || isProfileFieldsTouched || isUsernameAvailable === true;
  }, [photo, isProfileFieldsTouched, isUsernameError, isUsernameAvailable]);

  useHistoryBack(isActive, onReset, onScreenSelect, SettingsScreens.EditProfile);

  // Due to the parent Transition, this component never gets unmounted,
  // that's why we use throttled API call on every update.
  useEffect(() => {
    runThrottled(() => {
      loadCurrentUser();
    });
  }, [loadCurrentUser]);

  useEffect(() => {
    setPhoto(undefined);
  }, [currentAvatarBlobUrl]);

  useEffect(() => {
    setFirstName(currentFirstName || '');
    setLastName(currentLastName || '');
    setBio(currentBio || '');
  }, [currentFirstName, currentLastName, currentBio]);

  useEffect(() => {
    setUsername(currentUsername || '');
  }, [currentUsername]);

  useEffect(() => {
    if (progress === ProfileEditProgress.Complete) {
      setIsProfileFieldsTouched(false);
      setIsUsernameTouched(false);
      setError(undefined);
    }
  }, [progress]);

  const handlePhotoChange = useCallback((newPhoto: File) => {
    setPhoto(newPhoto);
  }, []);

  const handleFirstNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setFirstName(e.target.value);
    setIsProfileFieldsTouched(true);
  }, []);

  const handleLastNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setLastName(e.target.value);
    setIsProfileFieldsTouched(true);
  }, []);

  const handleBioChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setBio(e.target.value);
    setIsProfileFieldsTouched(true);
  }, []);

  const handleUsernameChange = useCallback((value: string | false) => {
    setUsername(value);
    setIsUsernameTouched(true);
  }, []);

  const handleProfileSave = useCallback(() => {
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedBio = bio.trim();

    if (!trimmedFirstName.length) {
      setError(ERROR_FIRST_NAME_MISSING);
      return;
    }

    if (trimmedBio.length > MAX_BIO_LENGTH) {
      setError(ERROR_BIO_TOO_LONG);
      return;
    }

    updateProfile({
      photo,
      ...(isProfileFieldsTouched && {
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        bio: trimmedBio,
      }),
      ...(isUsernameTouched && {
        username,
      }),
    });
  }, [
    photo,
    firstName, lastName, bio, isProfileFieldsTouched,
    username, isUsernameTouched,
    updateProfile,
  ]);

  return (
    <div className="settings-fab-wrapper">
      <div className="settings-content custom-scroll">
        <div className="settings-edit-profile">
          <AvatarEditable
            currentAvatarBlobUrl={currentAvatarBlobUrl}
            onChange={handlePhotoChange}
            title="Edit your profile photo"
            disabled={isLoading}
          />
          <InputText
            value={firstName}
            onChange={handleFirstNameChange}
            label={lang('FirstName')}
            disabled={isLoading}
            error={error === ERROR_FIRST_NAME_MISSING ? error : undefined}
          />
          <InputText
            value={lastName}
            onChange={handleLastNameChange}
            label={lang('LastName')}
            disabled={isLoading}
          />
          <InputText
            value={bio}
            onChange={handleBioChange}
            label={lang('UserBio')}
            disabled={isLoading}
            error={error === ERROR_BIO_TOO_LONG ? error : undefined}
          />

          <p className="settings-item-description" dir={lang.isRtl ? 'rtl' : undefined}>
            {renderText(lang('lng_settings_about_bio'), ['br', 'simple_markdown'])}
          </p>
        </div>

        <div className="settings-item">
          <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>{lang('Username')}</h4>

          <UsernameInput
            currentUsername={username || ''}
            isLoading={isLoading}
            isUsernameAvailable={isUsernameAvailable}
            checkUsername={checkUsername}
            onChange={handleUsernameChange}
          />

          <p className="settings-item-description" dir={lang.isRtl ? 'rtl' : undefined}>
            {renderText(lang('UsernameHelp'), ['br', 'simple_markdown'])}
          </p>
          {username && (
            <p className="settings-item-description" dir={lang.isRtl ? 'rtl' : undefined}>
              {lang('lng_username_link')}<br />
              <span className="username-link">https://t.me/{username}</span>
            </p>
          )}
        </div>
      </div>

      <FloatingActionButton
        isShown={isSaveButtonShown}
        onClick={handleProfileSave}
        disabled={isLoading}
        ariaLabel="Save changes"
      >
        {isLoading ? (
          <Spinner color="white" />
        ) : (
          <i className="icon-check" />
        )}
      </FloatingActionButton>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { currentUserId } = global;
    const { progress, isUsernameAvailable } = global.profileEdit || {};
    const currentUser = currentUserId ? selectUser(global, currentUserId) : undefined;

    if (!currentUser) {
      return {
        progress,
        isUsernameAvailable,
      };
    }

    const {
      firstName: currentFirstName,
      lastName: currentLastName,
      username: currentUsername,
      fullInfo,
    } = currentUser;
    const { bio: currentBio } = fullInfo || {};
    const currentAvatarHash = getChatAvatarHash(currentUser);

    return {
      currentAvatarHash,
      currentFirstName,
      currentLastName,
      currentBio,
      currentUsername,
      progress,
      isUsernameAvailable,
    };
  },
)(SettingsEditProfile));
