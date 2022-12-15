import type { ChangeEvent } from 'react';
import React, {
  useState, useCallback, memo, useEffect, useMemo,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
import type { ApiUsername } from '../../../api/types';
import { ApiMediaFormat } from '../../../api/types';
import { ProfileEditProgress } from '../../../types';

import { PURCHASE_USERNAME, TME_LINK_PREFIX, USERNAME_PURCHASE_ERROR } from '../../../config';
import { throttle } from '../../../util/schedulers';
import { selectUser } from '../../../global/selectors';
import { getChatAvatarHash } from '../../../global/helpers';
import { selectCurrentLimit } from '../../../global/selectors/limits';
import renderText from '../../common/helpers/renderText';
import useMedia from '../../../hooks/useMedia';
import useLang from '../../../hooks/useLang';
import useHistoryBack from '../../../hooks/useHistoryBack';
import usePrevious from '../../../hooks/usePrevious';

import AvatarEditable from '../../ui/AvatarEditable';
import FloatingActionButton from '../../ui/FloatingActionButton';
import Spinner from '../../ui/Spinner';
import InputText from '../../ui/InputText';
import UsernameInput from '../../common/UsernameInput';
import TextArea from '../../ui/TextArea';
import ManageUsernames from '../../common/ManageUsernames';
import SafeLink from '../../common/SafeLink';

type OwnProps = {
  isActive: boolean;
  onReset: () => void;
};

type StateProps = {
  currentAvatarHash?: string;
  currentFirstName?: string;
  currentLastName?: string;
  currentBio?: string;
  progress?: ProfileEditProgress;
  checkedUsername?: string;
  editUsernameError?: string;
  isUsernameAvailable?: boolean;
  maxBioLength: number;
  usernames?: ApiUsername[];
};

const runThrottled = throttle((cb) => cb(), 60000, true);

const ERROR_FIRST_NAME_MISSING = 'Please provide your first name';

const SettingsEditProfile: FC<OwnProps & StateProps> = ({
  isActive,
  currentAvatarHash,
  currentFirstName,
  currentLastName,
  currentBio,
  progress,
  checkedUsername,
  editUsernameError,
  isUsernameAvailable,
  maxBioLength,
  usernames,
  onReset,
}) => {
  const {
    loadCurrentUser,
    updateProfile,
  } = getActions();

  const lang = useLang();

  const firstEditableUsername = useMemo(() => usernames?.find(({ isEditable }) => isEditable), [usernames]);
  const currentUsername = firstEditableUsername?.username || '';
  const [isUsernameTouched, setIsUsernameTouched] = useState(false);
  const [isProfileFieldsTouched, setIsProfileFieldsTouched] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const [photo, setPhoto] = useState<File | undefined>();
  const [firstName, setFirstName] = useState(currentFirstName || '');
  const [lastName, setLastName] = useState(currentLastName || '');
  const [bio, setBio] = useState(currentBio || '');
  const [editableUsername, setEditableUsername] = useState<string | false>(currentUsername);

  const currentAvatarBlobUrl = useMedia(currentAvatarHash, false, ApiMediaFormat.BlobUrl);

  const isLoading = progress === ProfileEditProgress.InProgress;
  const isUsernameError = editableUsername === false;

  const previousIsUsernameAvailable = usePrevious(isUsernameAvailable);
  const renderingIsUsernameAvailable = isUsernameAvailable ?? previousIsUsernameAvailable;
  const shouldRenderUsernamesManage = usernames && usernames.length > 1;

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
    setEditableUsername(currentUsername || '');
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
    setEditableUsername(value);
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
        username: editableUsername,
      }),
    });
  }, [
    photo,
    firstName, lastName, bio, isProfileFieldsTouched,
    editableUsername, isUsernameTouched,
    updateProfile,
  ]);

  function renderPurchaseLink() {
    const purchaseInfoLink = `${TME_LINK_PREFIX}${PURCHASE_USERNAME}`;

    return (
      <p className="settings-item-description" dir={lang.isRtl ? 'rtl' : undefined}>
        {(lang('lng_username_purchase_available') as string)
          .replace('{link}', '%PURCHASE_LINK%')
          .split('%')
          .map((s) => {
            return (s === 'PURCHASE_LINK' ? <SafeLink url={purchaseInfoLink} text={`@${PURCHASE_USERNAME}`} /> : s);
          })}
      </p>
    );
  }

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

          {editUsernameError === USERNAME_PURCHASE_ERROR && renderPurchaseLink()}
          <p className="settings-item-description" dir={lang.isRtl ? 'rtl' : undefined}>
            {renderText(lang('UsernameHelp'), ['br', 'simple_markdown'])}
          </p>
          {editableUsername && (
            <p className="settings-item-description" dir={lang.isRtl ? 'rtl' : undefined}>
              {lang('lng_username_link')}<br />
              <span className="username-link">{TME_LINK_PREFIX}{editableUsername}</span>
            </p>
          )}
        </div>

        {shouldRenderUsernamesManage && (
          <ManageUsernames
            usernames={usernames}
            onEditUsername={setEditableUsername}
          />
        )}
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
    const {
      progress, isUsernameAvailable, checkedUsername, error: editUsernameError,
    } = global.profileEdit || {};
    const currentUser = currentUserId ? selectUser(global, currentUserId) : undefined;

    const maxBioLength = selectCurrentLimit(global, 'aboutLength');

    if (!currentUser) {
      return {
        progress,
        checkedUsername,
        isUsernameAvailable,
        editUsernameError,
        maxBioLength,
      };
    }

    const {
      firstName: currentFirstName,
      lastName: currentLastName,
      usernames,
      fullInfo,
    } = currentUser;
    const { bio: currentBio } = fullInfo || {};
    const currentAvatarHash = getChatAvatarHash(currentUser);

    return {
      currentAvatarHash,
      currentFirstName,
      currentLastName,
      currentBio,
      progress,
      isUsernameAvailable,
      checkedUsername,
      editUsernameError,
      maxBioLength,
      usernames,
    };
  },
)(SettingsEditProfile));
