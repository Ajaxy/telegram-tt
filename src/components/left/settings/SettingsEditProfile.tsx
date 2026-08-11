import {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiBirthday, ApiMessage, ApiUsername } from '../../../api/types';
import type { GlobalState } from '../../../global/types';
import { ApiMediaFormat } from '../../../api/types';
import { ProfileEditProgress, SettingsScreens } from '../../../types';

import { PURCHASE_USERNAME, TME_LINK_PREFIX, USERNAME_PURCHASE_ERROR } from '../../../config';
import { getChatAvatarHash } from '../../../global/helpers';
import { filterPeersByQuery } from '../../../global/helpers/peers';
import {
  selectChat, selectChatMessage, selectTabState, selectUser, selectUserFullInfo,
} from '../../../global/selectors';
import { selectCurrentLimit } from '../../../global/selectors/limits';
import { formatDateToString } from '../../../util/dates/oldDateFormat';
import { NEXT_ARROW_REPLACEMENT } from '../../../util/localization/format';
import { throttle } from '../../../util/schedulers';
import renderText from '../../common/helpers/renderText';
import { ChatAnimationTypes } from '../main/hooks';

import useSelector from '../../../hooks/data/useSelector';
import useEnsureMessage from '../../../hooks/useEnsureMessage';
import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useMedia from '../../../hooks/useMedia';
import useOldLang from '../../../hooks/useOldLang';
import usePreviousDeprecated from '../../../hooks/usePreviousDeprecated';

import ManageUsernames from '../../common/ManageUsernames';
import ChatOrUserPicker from '../../common/pickers/ChatOrUserPicker';
import SafeLink from '../../common/SafeLink';
import UsernameInput from '../../common/UsernameInput';
import Island, { IslandDescription, IslandOutside, IslandTitle } from '../../gili/layout/Island';
import Surface from '../../gili/layout/Surface';
import AvatarEditable from '../../ui/AvatarEditable';
import Button from '../../ui/Button';
import FloatingActionButton from '../../ui/FloatingActionButton';
import InputText from '../../ui/InputText';
import Link from '../../ui/Link';
import ListItem from '../../ui/ListItem';
import TextArea from '../../ui/TextArea';
import Chat from '../main/Chat';

import styles from './SettingsEditProfile.module.scss';

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
  currentPersonalChannelId?: string;
  currentPersonalChannelMessageId?: number;
  currentPersonalChannelMessage?: ApiMessage;
  progress?: ProfileEditProgress;
  checkedUsername?: string;
  editUsernameError?: string;
  isUsernameAvailable?: boolean;
  maxBioLength: number;
  personalChannelIds?: string[];
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
  currentPersonalChannelId,
  currentPersonalChannelMessageId,
  currentPersonalChannelMessage,
  progress,
  checkedUsername,
  editUsernameError,
  isUsernameAvailable,
  maxBioLength,
  personalChannelIds,
  usernames,
  onReset,
}: OwnProps & StateProps) => {
  const {
    loadCurrentUser,
    loadPersonalChannels,
    updateProfile,
    openSettingsScreen,
    openBirthdaySetupModal,
    showNotification,
  } = getActions();

  const oldLang = useOldLang();
  const lang = useLang();

  const firstEditableUsername = useMemo(() => usernames?.find(({ isEditable }) => isEditable), [usernames]);
  const currentUsername = firstEditableUsername?.username || '';
  const [isUsernameTouched, setIsUsernameTouched] = useState(false);
  const [isProfileFieldsTouched, setIsProfileFieldsTouched] = useState(false);
  const [isPersonalChannelTouched, setIsPersonalChannelTouched] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const [photo, setPhoto] = useState<File | undefined>();
  const [firstName, setFirstName] = useState(currentFirstName || '');
  const [lastName, setLastName] = useState(currentLastName || '');
  const [bio, setBio] = useState(currentBio || '');
  const [editableUsername, setEditableUsername] = useState<string | false>(currentUsername);
  const [personalChannelId, setPersonalChannelId] = useState(currentPersonalChannelId);
  const [personalChannelSearch, setPersonalChannelSearch] = useState('');
  const [isPersonalChannelPickerOpen, openPersonalChannelPicker, closePersonalChannelPicker] = useFlag();

  const selectPersonalChannel = useCallback((global: GlobalState) => {
    return personalChannelId ? selectChat(global, personalChannelId) : undefined;
  }, [personalChannelId]);
  const personalChannel = useSelector(selectPersonalChannel);

  useEnsureMessage(
    currentPersonalChannelId!,
    currentPersonalChannelMessageId,
    currentPersonalChannelMessage,
    undefined,
    !currentPersonalChannelId,
  );

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

    return Boolean(photo) || isProfileFieldsTouched || isPersonalChannelTouched
      || (isUsernameTouched && renderingIsUsernameAvailable === true);
  }, [
    isUsernameError, photo, isProfileFieldsTouched, isPersonalChannelTouched,
    isUsernameTouched, renderingIsUsernameAvailable,
  ]);

  const filteredPersonalChannelIds = useMemo(() => {
    return filterPeersByQuery({
      ids: personalChannelIds || [],
      query: personalChannelSearch,
      type: 'chat',
    });
  }, [personalChannelIds, personalChannelSearch]);

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
    if (isActive) {
      loadPersonalChannels();
    }
  }, [isActive, loadPersonalChannels]);

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
    if (isPersonalChannelTouched) return;

    setPersonalChannelId(currentPersonalChannelId);
  }, [currentPersonalChannelId, isPersonalChannelTouched]);

  useEffect(() => {
    if (progress === ProfileEditProgress.Complete) {
      setIsProfileFieldsTouched(false);
      setIsPersonalChannelTouched(false);
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

  const handlePersonalChannelPickerOpen = useLastCallback(() => {
    if (!personalChannelIds?.length && !personalChannelId) {
      showNotification({ message: { key: 'PersonalChannelNoChannels' } });
      return;
    }

    openPersonalChannelPicker();
  });

  const handlePersonalChannelPickerClose = useLastCallback(() => {
    closePersonalChannelPicker();
    setPersonalChannelSearch('');
  });

  const handlePersonalChannelSelect = useLastCallback((channelId: string) => {
    setPersonalChannelId(channelId);
    setIsPersonalChannelTouched(channelId !== currentPersonalChannelId);
    handlePersonalChannelPickerClose();
  });

  const handlePersonalChannelRemove = useLastCallback(() => {
    setPersonalChannelId(undefined);
    setIsPersonalChannelTouched(Boolean(currentPersonalChannelId));
    handlePersonalChannelPickerClose();
  });

  const handleProfileSave = useLastCallback(() => {
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedBio = bio.trim();

    if (editableUsername === false) return;
    if (isUsernameTouched && !editableUsername) return;

    if (!trimmedFirstName.length) {
      setError(ERROR_FIRST_NAME_MISSING);
      return;
    }

    updateProfile({
      photo,
      firstName: isProfileFieldsTouched ? trimmedFirstName : undefined,
      lastName: isProfileFieldsTouched ? trimmedLastName : undefined,
      bio: isProfileFieldsTouched ? trimmedBio : undefined,
      username: isUsernameTouched ? editableUsername : undefined,
      personalChannelId: isPersonalChannelTouched ? personalChannelId || false : undefined,
    });
  });

  const personalChannelPickerFooter = useMemo(() => {
    if (!personalChannelId) return undefined;

    return (
      <div className="picker-footer">
        <Button
          className="picker-footer-button"
          color="danger"
          onClick={handlePersonalChannelRemove}
        >
          {lang('PersonalChannelRemove')}
        </Button>
      </div>
    );
  }, [handlePersonalChannelRemove, lang, personalChannelId]);

  function renderPurchaseLink() {
    const purchaseInfoLink = `${TME_LINK_PREFIX}${PURCHASE_USERNAME}`;

    return (
      <IslandDescription dir={oldLang.isRtl ? 'rtl' : undefined}>
        {(oldLang('lng_username_purchase_available'))
          .replace('{link}', '%PURCHASE_LINK%')
          .split('%')
          .map((s) => {
            return (s === 'PURCHASE_LINK' ? <SafeLink url={purchaseInfoLink} text={`@${PURCHASE_USERNAME}`} /> : s);
          })}
      </IslandDescription>
    );
  }

  return (
    <div className="settings-fab-wrapper">
      <Surface scrollable className="settings-content no-border">
        <IslandOutside className="settings-content-header">
          <AvatarEditable
            currentAvatarBlobUrl={currentAvatarBlobUrl}
            onChange={handlePhotoChange}
            title={lang('AriaSettingsEditProfilePhoto')}
            disabled={isLoading}
          />
        </IslandOutside>
        <Island>
          <div className="settings-input">
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
        </Island>
        <IslandDescription dir={oldLang.isRtl ? 'rtl' : undefined}>
          {renderText(oldLang('lng_settings_about_bio'), ['br', 'simple_markdown'])}
        </IslandDescription>

        <Island>
          <ListItem
            icon="birthday-filled"
            iconBg="purple"
            narrow
            rightElement={formattedBirthday ?
              <span className="settings-birthday-date">{formattedBirthday}</span>
              : undefined}
            onClick={handleBirthdayClick}
          >
            <span className="flex-grow">{lang('SettingsBirthday')}</span>
          </ListItem>
        </Island>
        <IslandDescription dir={oldLang.isRtl ? 'rtl' : undefined}>
          {lang('BirthdayPrivacySuggestion', {
            link: (
              <Link isPrimary onClick={handleBirthdayPrivacyClick}>
                {lang('BirthdayPrivacySuggestionLink',
                  undefined, { withNodes: true, specialReplacement: NEXT_ARROW_REPLACEMENT })}
              </Link>
            ),
          }, { withNodes: true })}
        </IslandDescription>

        <IslandTitle dir={oldLang.isRtl ? 'rtl' : undefined}>{oldLang('Username')}</IslandTitle>
        <Island>
          <div className="settings-input">
            <UsernameInput
              currentUsername={currentUsername}
              isLoading={isLoading}
              isUsernameAvailable={isUsernameAvailable}
              checkedUsername={checkedUsername}
              onChange={handleUsernameChange}
            />
          </div>
        </Island>
        {editUsernameError === USERNAME_PURCHASE_ERROR && renderPurchaseLink()}
        <IslandDescription dir={oldLang.isRtl ? 'rtl' : undefined}>
          {renderText(oldLang('UsernameHelp'), ['br', 'simple_markdown'])}
        </IslandDescription>
        {editableUsername && (
          <IslandDescription dir={oldLang.isRtl ? 'rtl' : undefined}>
            {oldLang('lng_username_link')}
            <br />
            <span className="username-link">
              {TME_LINK_PREFIX}
              {editableUsername}
            </span>
          </IslandDescription>
        )}

        {shouldRenderUsernamesManage && (
          <ManageUsernames
            usernames={usernames}
            onEditUsername={setEditableUsername}
          />
        )}

        <Island>
          {personalChannel ? (
            <div className={styles.personalChannelItem} onClick={handlePersonalChannelPickerOpen}>
              <Chat
                chatId={personalChannel.id}
                orderDiff={0}
                shiftDiff={0}
                animationType={ChatAnimationTypes.None}
                isPreview
                previewMessageId={personalChannelId === currentPersonalChannelId
                  ? currentPersonalChannelMessageId : undefined}
              />
            </div>
          ) : (
            <ListItem
              icon="megaphone-filled"
              iconBg="orange"
              multiline
              narrow
              disabled={personalChannelIds === undefined}
              onClick={handlePersonalChannelPickerOpen}
            >
              <span className="title">{lang('PersonalChannelTitle')}</span>
              <span className="subtitle">{lang('PersonalChannelAddHint')}</span>
            </ListItem>
          )}
        </Island>
        <IslandDescription dir={lang.isRtl ? 'rtl' : undefined}>
          {lang('PersonalChannelDescription')}
        </IslandDescription>
      </Surface>

      <FloatingActionButton
        isShown={isSaveButtonShown}
        onClick={handleProfileSave}
        disabled={isLoading}
        ariaLabel={oldLang('Save')}
        iconName="check"
        isLoading={isLoading}
      />

      <ChatOrUserPicker
        isOpen={isPersonalChannelPickerOpen}
        chatOrUserIds={filteredPersonalChannelIds}
        title={lang('PersonalChannelPickerTitle')}
        searchPlaceholder={lang('Search')}
        search={personalChannelSearch}
        footer={personalChannelPickerFooter}
        onSearchChange={setPersonalChannelSearch}
        onSelectChatOrUser={handlePersonalChannelSelect}
        onClose={handlePersonalChannelPickerClose}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const { currentUserId } = global;
    const { profileEdit } = selectTabState(global);
    const {
      progress, isUsernameAvailable, checkedUsername, error: editUsernameError,
    } = profileEdit || {};
    const currentUser = currentUserId ? selectUser(global, currentUserId) : undefined;

    const maxBioLength = selectCurrentLimit(global, 'aboutLength');

    const {
      firstName: currentFirstName,
      lastName: currentLastName,
      usernames,
    } = currentUser || {};
    const currentUserFullInfo = currentUserId ? selectUserFullInfo(global, currentUserId) : undefined;
    const currentPersonalChannelId = currentUserFullInfo?.personalChannelId;
    const currentPersonalChannelMessageId = currentUserFullInfo?.personalChannelMessageId;
    const currentPersonalChannelMessage = currentPersonalChannelId && currentPersonalChannelMessageId
      ? selectChatMessage(global, currentPersonalChannelId, currentPersonalChannelMessageId) : undefined;
    const currentAvatarHash = currentUser && getChatAvatarHash(currentUser);

    return {
      currentAvatarHash,
      currentFirstName,
      currentLastName,
      currentBirthday: currentUserFullInfo?.birthday,
      currentBio: currentUserFullInfo?.bio,
      currentPersonalChannelId,
      currentPersonalChannelMessageId,
      currentPersonalChannelMessage,
      progress,
      isUsernameAvailable,
      checkedUsername,
      editUsernameError,
      maxBioLength,
      personalChannelIds: global.chats.personalChannelIds,
      usernames,
    };
  },
)(SettingsEditProfile));
