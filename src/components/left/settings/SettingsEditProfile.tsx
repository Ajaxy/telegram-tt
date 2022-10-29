import type { ChangeEvent } from 'react';
import type { FC } from '../../../lib/teact/teact';
import React, {
  useState, useCallback, memo, useEffect, useMemo,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { ApiMediaFormat } from '../../../api/types';
import { ProfileEditProgress } from '../../../types';

import { TME_LINK_PREFIX } from '../../../config';
import { throttle } from '../../../util/schedulers';
import { selectUser } from '../../../global/selectors';
import { getChatAvatarHash } from '../../../global/helpers';
import useMedia from '../../../hooks/useMedia';
import useLang from '../../../hooks/useLang';
import { selectCurrentLimit } from '../../../global/selectors/limits';
import renderText from '../../common/helpers/renderText';
import useHistoryBack from '../../../hooks/useHistoryBack';
import usePrevious from '../../../hooks/usePrevious';

import AvatarEditable from '../../ui/AvatarEditable';
import FloatingActionButton from '../../ui/FloatingActionButton';
import Spinner from '../../ui/Spinner';
import InputText from '../../ui/InputText';
import UsernameInput from '../../common/UsernameInput';
import TextArea from '../../ui/TextArea';

type OwnProps = {
  isActive: boolean;
  onReset: () => void;
};

type StateProps = {
  currentAvatarHash?: string;
  currentFirstName?: string;
  currentLastName?: string;
  currentBio?: string;
  currentUsername?: string;
  progress?: ProfileEditProgress;
  checkedUsername?: string;
  isUsernameAvailable?: boolean;
  maxBioLength: number;
};

const runThrottled = throttle((cb) => cb(), 60000, true);

const ERROR_FIRST_NAME_MISSING = 'Please provide your first name';

const SettingsEditProfile: FC<OwnProps & StateProps> = ({
  isActive,
  currentAvatarHash,
  currentFirstName,
  currentLastName,
  currentBio,
  currentUsername,
  progress,
  checkedUsername,
  isUsernameAvailable,
  maxBioLength,
  onReset,
}) => {
  const {
    loadCurrentUser,
    updateProfile,
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

  const previousIsUsernameAvailable = usePrevious(isUsernameAvailable);
  const renderingIsUsernameAvailable = isUsernameAvailable ?? previousIsUsernameAvailable;

  const isSaveButtonShown = useMemo(() => {
    if (isUsernameError) {
      return false;
    }

    return Boolean(photo) || isProfileFieldsTouched || (isUsernameTouched && renderingIsUsernameAvailable === true);
  }, [isUsernameError, photo, isProfileFieldsTouched, isUsernameTouched, renderingIsUsernameAvailable]);

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

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

  const handleBioChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setBio(e.target.value);
    setIsProfileFieldsTouched(true);
  }, []);

  const handleUsernameChange = useCallback((value: string | false) => {
    setUsername(value);
    setIsUsernameTouched(currentUsername !== value);
  }, [currentUsername]);

  const handleProfileSave = useCallback(() => {
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedBio = bio.trim();

    if (!trimmedFirstName.length) {
      setError(ERROR_FIRST_NAME_MISSING);
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
      <div className="settings-content no-border custom-scroll">
        <div className="settings-edit-profile settings-item">
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
          <TextArea
            value={bio}
            onChange={handleBioChange}
            label={lang('UserBio')}
            disabled={isLoading}
            maxLength={maxBioLength}
            maxLengthIndicator={maxBioLength ? (maxBioLength - bio.length).toString() : undefined}
          />

          <p className="settings-item-description" dir={lang.isRtl ? 'rtl' : undefined}>
            {renderText(lang('lng_settings_about_bio'), ['br', 'simple_markdown'])}
          </p>
        </div>

        <div className="settings-item">
          <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>{lang('Username')}</h4>

          <UsernameInput
            currentUsername={currentUsername}
            isLoading={isLoading}
            isUsernameAvailable={isUsernameAvailable}
            checkedUsername={checkedUsername}
            onChange={handleUsernameChange}
          />

          <p className="settings-item-description" dir={lang.isRtl ? 'rtl' : undefined}>
            {renderText(lang('UsernameHelp'), ['br', 'simple_markdown'])}
          </p>
          {username && (
            <p className="settings-item-description" dir={lang.isRtl ? 'rtl' : undefined}>
              {lang('lng_username_link')}<br />
              <span className="username-link">{TME_LINK_PREFIX}{username}</span>
            </p>
          )}
        </div>
      </div>

      <FloatingActionButton
        isShown={isSaveButtonShown}
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
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { currentUserId } = global;
    const { progress, isUsernameAvailable, checkedUsername } = global.profileEdit || {};
    const currentUser = currentUserId ? selectUser(global, currentUserId) : undefined;

    const maxBioLength = selectCurrentLimit(global, 'aboutLength');

    if (!currentUser) {
      return {
        progress,
        checkedUsername,
        isUsernameAvailable,
        maxBioLength,
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
      checkedUsername,
      maxBioLength,
    };
  },
)(SettingsEditProfile));
