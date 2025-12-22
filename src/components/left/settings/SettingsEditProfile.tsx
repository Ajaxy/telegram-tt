import {
  memo, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiBirthday, ApiUsername } from '../../../api/types';
import { ApiMediaFormat } from '../../../api/types';
import { ProfileEditProgress, SettingsScreens } from '../../../types';

import { PURCHASE_USERNAME, TME_LINK_PREFIX, USERNAME_PURCHASE_ERROR } from '../../../config';
import { getChatAvatarHash } from '../../../global/helpers';
import { selectTabState, selectUser, selectUserFullInfo } from '../../../global/selectors';
import { selectCurrentLimit } from '../../../global/selectors/limits';
import { formatDateToString } from '../../../util/dates/dateFormat';
import { throttle } from '../../../util/schedulers';
import renderText from '../../common/helpers/renderText';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useMedia from '../../../hooks/useMedia';
import useOldLang from '../../../hooks/useOldLang';
import usePreviousDeprecated from '../../../hooks/usePreviousDeprecated';

import ManageUsernames from '../../common/ManageUsernames';
import SafeLink from '../../common/SafeLink';
import UsernameInput from '../../common/UsernameInput';
import AvatarEditable from '../../ui/AvatarEditable';
import FloatingActionButton from '../../ui/FloatingActionButton';
import InputText from '../../ui/InputText';
import Link from '../../ui/Link';
import ListItem from '../../ui/ListItem';
import TextArea from '../../ui/TextArea';

type OwnProps = {
  isActive: boolean;
  onReset: () => void;
};

type StateProps = {
  currentAvatarHash?: string;
  currentFirstName?: string;
  currentLastName?: string;
  currentBirthday?: ApiBirthday;
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

const SettingsEditProfile = ({
  isActive,
  currentAvatarHash,
  currentFirstName,
  currentLastName,
  currentBirthday,
  currentBio,
  progress,
  checkedUsername,
  editUsernameError,
  isUsernameAvailable,
  maxBioLength,
  usernames,
  onReset,
}: OwnProps & StateProps) => {
  const {
    loadCurrentUser,
    updateProfile,
    openSettingsScreen,
    openBirthdaySetupModal,
  } = getActions();

  const oldLang = useOldLang();
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

  const previousIsUsernameAvailable = usePreviousDeprecated(isUsernameAvailable);
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

  const formattedBirthday = useMemo(() => {
    if (!currentBirthday) return undefined;

    const date = new Date(
      currentBirthday.year || 2024, // Use leap year as fallback
      currentBirthday.month - 1,
      currentBirthday.day,
    );

    return formatDateToString(date, lang.code, true, 'long');
  }, [currentBirthday, lang]);

  const handlePhotoChange = useLastCallback((newPhoto: File) => {
    setPhoto(newPhoto);
  });

  const handleFirstNameChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFirstName(e.target.value);
    setIsProfileFieldsTouched(true);
  });

  const handleLastNameChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLastName(e.target.value);
    setIsProfileFieldsTouched(true);
  });

  const handleBioChange = useLastCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBio(e.target.value);
    setIsProfileFieldsTouched(true);
  });

  const handleUsernameChange = useLastCallback((value: string | false) => {
    setEditableUsername(value);
    setIsUsernameTouched(currentUsername !== value);
  });

  const handleBirthdayPrivacyClick = useLastCallback(() => {
    openSettingsScreen({ screen: SettingsScreens.PrivacyBirthday });
  });

  const handleBirthdayClick = useLastCallback(() => {
    openBirthdaySetupModal({ currentBirthday });
  });

  const handleProfileSave = useLastCallback(() => {
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedBio = bio.trim();

    if (!editableUsername) return;

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
  });

  function renderPurchaseLink() {
    const purchaseInfoLink = `${TME_LINK_PREFIX}${PURCHASE_USERNAME}`;

    return (
      <p className="settings-item-description" dir={oldLang.isRtl ? 'rtl' : undefined}>
        {(oldLang('lng_username_purchase_available'))
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
        <div className="settings-item">
          <div className="settings-input">
            <AvatarEditable
              currentAvatarBlobUrl={currentAvatarBlobUrl}
              onChange={handlePhotoChange}
              title={lang('AriaSettingsEditProfilePhoto')}
              disabled={isLoading}
            />
            <InputText
              value={firstName}
              onChange={handleFirstNameChange}
              label={oldLang('FirstName')}
              disabled={isLoading}
              error={error === ERROR_FIRST_NAME_MISSING ? error : undefined}
            />
            <InputText
              value={lastName}
              onChange={handleLastNameChange}
              label={oldLang('LastName')}
              disabled={isLoading}
            />
            <TextArea
              value={bio}
              onChange={handleBioChange}
              label={oldLang('UserBio')}
              disabled={isLoading}
              maxLength={maxBioLength}
              maxLengthIndicator={maxBioLength ? (maxBioLength - bio.length).toString() : undefined}
            />
          </div>

          <p className="settings-item-description" dir={oldLang.isRtl ? 'rtl' : undefined}>
            {renderText(oldLang('lng_settings_about_bio'), ['br', 'simple_markdown'])}
          </p>
        </div>

        <div className="settings-item">
          <ListItem
            icon="gift"
            narrow
            rightElement={formattedBirthday ?
              <span className="settings-birthday-date">{formattedBirthday}</span>
              : undefined}
            onClick={handleBirthdayClick}
          >
            <span className="flex-grow">{lang('SettingsBirthday')}</span>
          </ListItem>
          <p className="settings-item-description" dir={oldLang.isRtl ? 'rtl' : undefined}>
            {lang('BirthdayPrivacySuggestion', {
              link: <Link isPrimary onClick={handleBirthdayPrivacyClick}>{lang('BirthdayPrivacySuggestionLink')}</Link>,
            }, { withNodes: true })}
          </p>
        </div>

        <div className="settings-item">
          <h4 className="settings-item-header" dir={oldLang.isRtl ? 'rtl' : undefined}>{oldLang('Username')}</h4>

          <div className="settings-input">
            <UsernameInput
              currentUsername={currentUsername}
              isLoading={isLoading}
              isUsernameAvailable={isUsernameAvailable}
              checkedUsername={checkedUsername}
              onChange={handleUsernameChange}
            />
          </div>

          {editUsernameError === USERNAME_PURCHASE_ERROR && renderPurchaseLink()}
          <p className="settings-item-description" dir={oldLang.isRtl ? 'rtl' : undefined}>
            {renderText(oldLang('UsernameHelp'), ['br', 'simple_markdown'])}
          </p>
          {editableUsername && (
            <p className="settings-item-description" dir={oldLang.isRtl ? 'rtl' : undefined}>
              {oldLang('lng_username_link')}
              <br />
              <span className="username-link">
                {TME_LINK_PREFIX}
                {editableUsername}
              </span>
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
        ariaLabel={oldLang('Save')}
        iconName="check"
        isLoading={isLoading}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const { currentUserId } = global;
    const {
      progress, isUsernameAvailable, checkedUsername, error: editUsernameError,
    } = selectTabState(global).profileEdit || {};
    const currentUser = currentUserId ? selectUser(global, currentUserId) : undefined;

    const maxBioLength = selectCurrentLimit(global, 'aboutLength');

    const {
      firstName: currentFirstName,
      lastName: currentLastName,
      usernames,
    } = currentUser || {};
    const currentUserFullInfo = currentUserId ? selectUserFullInfo(global, currentUserId) : undefined;
    const currentAvatarHash = currentUser && getChatAvatarHash(currentUser);

    return {
      currentAvatarHash,
      currentFirstName,
      currentLastName,
      currentBirthday: currentUserFullInfo?.birthday,
      currentBio: currentUserFullInfo?.bio,
      progress,
      isUsernameAvailable,
      checkedUsername,
      editUsernameError,
      maxBioLength,
      usernames,
    };
  },
)(SettingsEditProfile));
