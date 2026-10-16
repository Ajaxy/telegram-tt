import { memo, useEffect, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiPrivacySettings } from '../../../api/types';
import type { GlobalState } from '../../../global/types';
import { SettingsScreens } from '../../../types';

import { ACCOUNT_TTL_OPTIONS } from '../../../config';
import {
  selectCanSetPasscode, selectIsCurrentUserFrozen,
  selectIsCurrentUserPremium,
} from '../../../global/selectors';
import { selectSharedSettings } from '../../../global/selectors/sharedState';
import { formatCountdown } from '../../../util/dates/duration';
import { getClosestEntry } from '../../../util/getClosestEntry';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import StarIcon from '../../common/icons/StarIcon';
import Island, { IslandTitle } from '../../gili/layout/Island';
import Button from '../../ui/Button';
import Checkbox from '../../ui/Checkbox';
import ListItem from '../../ui/ListItem';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = {
  isCurrentUserPremium?: boolean;
  hasPassword?: boolean;
  hasPasscode?: boolean;
  canSetPasscode?: boolean;
  blockedCount: number;
  webAuthCount: number;
  isSensitiveEnabled?: boolean;
  canChangeSensitive?: boolean;
  canDisplayAutoarchiveSetting: boolean;
  shouldArchiveAndMuteNewNonContact?: boolean;
  shouldNewNonContactPeersRequirePremium?: boolean;
  shouldChargeForMessages: boolean;
  canDisplayChatInTitle?: boolean;
  isCurrentUserFrozen?: boolean;
  needAgeVideoVerification?: boolean;
  privacy: GlobalState['settings']['privacy'];
  accountDaysTtl?: number;
  defaultHistoryTtl?: number;
  passkeyCount?: number;
  arePasskeysAvailable?: boolean;
};

const DAYS_PER_MONTH = 30;

const SettingsPrivacy = ({
  isActive,
  isCurrentUserPremium,
  hasPassword,
  hasPasscode,
  blockedCount,
  webAuthCount,
  passkeyCount,
  arePasskeysAvailable,
  isSensitiveEnabled,
  canChangeSensitive,
  canDisplayAutoarchiveSetting,
  shouldArchiveAndMuteNewNonContact,
  shouldNewNonContactPeersRequirePremium,
  shouldChargeForMessages,
  canDisplayChatInTitle,
  canSetPasscode,
  needAgeVideoVerification,
  privacy,
  isCurrentUserFrozen,
  accountDaysTtl,
  defaultHistoryTtl,
  onReset,
}: OwnProps & StateProps) => {
  const {
    openDeleteAccountModal,
    loadPrivacySettings,
    loadBlockedUsers,
    updateContentSettings,
    loadDefaultHistoryTtl,
    loadGlobalPrivacySettings,
    updateGlobalPrivacySettings,
    loadWebAuthorizations,
    setSharedSettingOption,
    openSettingsScreen,
    loadAccountDaysTtl,
    openAgeVerificationModal,
    loadPasskeys,
    openPasskeyModal,
  } = getActions();

  useEffect(() => {
    if (!isCurrentUserFrozen) {
      loadBlockedUsers();
      loadPrivacySettings({});
      loadWebAuthorizations();
      loadPasskeys();
    }
  }, [isCurrentUserFrozen]);

  useEffect(() => {
    if (isActive && !isCurrentUserFrozen) {
      loadDefaultHistoryTtl();
      loadGlobalPrivacySettings();
      loadAccountDaysTtl();
    }
  }, [isActive, isCurrentUserFrozen]);

  const lang = useLang();
  const defaultHistoryTtlText = defaultHistoryTtl === undefined
    ? lang('Loading')
    : defaultHistoryTtl === 0
      ? lang('SettingsItemPrivacyOff')
      : formatCountdown(lang, defaultHistoryTtl);

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const handleArchiveAndMuteChange = useLastCallback((isEnabled: boolean) => {
    updateGlobalPrivacySettings({
      shouldArchiveAndMuteNewNonContact: isEnabled,
    });
  });

  const handleChatInTitleChange = useLastCallback((isChecked: boolean) => {
    setSharedSettingOption({
      canDisplayChatInTitle: isChecked,
    });
  });

  const handleUpdateContentSettings = useLastCallback((isChecked: boolean) => {
    updateContentSettings({ isSensitiveEnabled: isChecked });
  });

  const handleAgeVerification = useLastCallback(() => {
    openAgeVerificationModal();
  });

  const handleOpenDeleteAccountModal = useLastCallback(() => {
    if (!accountDaysTtl) return;
    openDeleteAccountModal({ days: accountDaysTtl });
  });

  const handleOpenPasskeys = useLastCallback(() => {
    if (!arePasskeysAvailable || passkeyCount === undefined) return;
    if (passkeyCount === 0) {
      openPasskeyModal();
      return;
    }

    openSettingsScreen({ screen: SettingsScreens.Passkeys });
  });

  const handleOpenAutoDeleteMessages = useLastCallback(() => {
    if (defaultHistoryTtl === undefined) return;

    openSettingsScreen({ screen: SettingsScreens.AutoDeleteMessages });
  });

  const dayOption = useMemo(() => {
    if (!accountDaysTtl) return undefined;
    return getClosestEntry(ACCOUNT_TTL_OPTIONS, accountDaysTtl / DAYS_PER_MONTH).toString();
  }, [accountDaysTtl]);

  function getVisibilityValue(setting?: ApiPrivacySettings) {
    if (!setting) return lang('Loading');

    const { visibility, shouldAllowPremium, botsPrivacy } = setting;

    const isAllowBots = botsPrivacy === 'allow';
    const isVisibilityEverybody = visibility === 'everybody';
    const shouldShowBotsString = isAllowBots && !isVisibilityEverybody;

    const blockCount = setting.blockChatIds.length + setting.blockUserIds.length;
    const allowCount = setting.allowChatIds.length + setting.allowUserIds.length;
    const total = [];
    if (blockCount) total.push(`-${blockCount}`);
    if (allowCount && !isVisibilityEverybody) total.push(`+${allowCount}`);

    const botPrivacyString = shouldShowBotsString ? lang('PrivacyValueBots') : '';
    const totalString = lang.conjunction(total);

    const exceptionString = [botPrivacyString, totalString].filter(Boolean).join(' ');
    if (shouldShowBotsString && !isVisibilityEverybody) return exceptionString;

    if (shouldAllowPremium) {
      return lang(exceptionString ? 'ContactsAndPremium' : 'PrivacyPremium');
    }

    switch (visibility) {
      case 'everybody':
        return `${lang('P2PEverybody')} ${exceptionString}`;

      case 'contacts':
        return `${lang('P2PContacts')} ${exceptionString}`;

      case 'nobody':
        return `${lang('P2PNobody')} ${exceptionString}`;
    }

    return undefined;
  }

  return (
    <div className="settings-content custom-scroll">
      <Island>
        <ListItem
          icon="block-filled"
          iconBg="red"
          narrow
          onClick={() => openSettingsScreen({ screen: SettingsScreens.PrivacyBlockedUsers })}
        >
          {lang('BlockedUsers')}
          <span className="settings-item__current-value">{blockedCount || ''}</span>
        </ListItem>
        {canSetPasscode && (
          <ListItem
            icon="lock-filled"
            iconBg="blue"
            narrow
            onClick={() => openSettingsScreen({
              screen: hasPasscode ? SettingsScreens.PasscodeEnabled : SettingsScreens.PasscodeDisabled,
            })}
          >
            <div className="multiline-item">
              <span className="title">{lang('Passcode')}</span>
              <span className="subtitle" dir="auto">
                {lang(hasPasscode ? 'SettingsItemPrivacyOn' : 'SettingsItemPrivacyOff')}
              </span>
            </div>
          </ListItem>
        )}
        <ListItem
          icon="2fa-filled"
          iconBg="green"
          narrow
          onClick={() => openSettingsScreen({
            screen: hasPassword ? SettingsScreens.TwoFaEnabled : SettingsScreens.TwoFaDisabled,
          })}
        >
          <div className="multiline-item">
            <span className="title">{lang('TwoStepVerification')}</span>
            <span className="subtitle" dir="auto">
              {lang(hasPassword ? 'SettingsItemPrivacyOn' : 'SettingsItemPrivacyOff')}
            </span>
          </div>
        </ListItem>
        {arePasskeysAvailable && (
          <ListItem
            icon="key-filled"
            iconBg="gray"
            narrow
            onClick={handleOpenPasskeys}
          >
            <div className="multiline-item">
              <span className="title">{lang('SettingsItemPrivacyPasskeys')}</span>
              <span className="subtitle" dir="auto">
                {lang(passkeyCount === undefined ? 'Loading'
                  : passkeyCount > 0 ? 'SettingsItemPrivacyOn' : 'SettingsItemPrivacyOff')}
              </span>
            </div>
          </ListItem>
        )}
        {webAuthCount > 0 && (
          <ListItem
            icon="web-filled"
            iconBg="purple"
            narrow
            onClick={() => openSettingsScreen({ screen: SettingsScreens.ActiveWebsites })}
          >
            {lang('PrivacySettingsWebSessions')}
            <span className="settings-item__current-value">{webAuthCount}</span>
          </ListItem>
        )}
        {!isCurrentUserFrozen && (
          <ListItem
            icon="timer-filled"
            iconBg="orange"
            narrow
            disabled={defaultHistoryTtl === undefined}
            onClick={handleOpenAutoDeleteMessages}
          >
            <div className="multiline-item">
              <span className="title">{lang('AutoDeleteMessages')}</span>
              <span className="subtitle" dir="auto">{defaultHistoryTtlText}</span>
            </div>
          </ListItem>
        )}
      </Island>

      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('PrivacyTitle')}</IslandTitle>
      <Island>
        <ListItem
          narrow
          className="no-icon"
          onClick={() => openSettingsScreen({ screen: SettingsScreens.PrivacyPhoneNumber })}
        >
          <div className="multiline-item">
            <span className="title">{lang('PrivacyPhoneTitle')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(privacy.phoneNumber)}
            </span>
          </div>
        </ListItem>
        <ListItem
          narrow
          className="no-icon"
          onClick={() => openSettingsScreen({ screen: SettingsScreens.PrivacyLastSeen })}
        >
          <div className="multiline-item">
            <span className="title">{lang('LastSeenTitle')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(privacy.lastSeen)}
            </span>
          </div>
        </ListItem>
        <ListItem
          narrow
          className="no-icon"
          onClick={() => openSettingsScreen({ screen: SettingsScreens.PrivacyProfilePhoto })}
        >
          <div className="multiline-item">
            <span className="title">{lang('PrivacyProfilePhotoTitle')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(privacy.profilePhoto)}
            </span>
          </div>
        </ListItem>
        <ListItem
          narrow
          className="no-icon"
          onClick={() => openSettingsScreen({ screen: SettingsScreens.PrivacyBio })}
        >
          <div className="multiline-item">
            <span className="title">{lang('PrivacyBio')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(privacy.bio)}
            </span>
          </div>
        </ListItem>
        <ListItem
          narrow
          className="no-icon"
          onClick={() => openSettingsScreen({ screen: SettingsScreens.PrivacyBirthday })}
        >
          <div className="multiline-item">
            <span className="title">{lang('PrivacyBirthday')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(privacy.birthday)}
            </span>
          </div>
        </ListItem>
        <ListItem
          narrow
          className="no-icon"
          onClick={() => openSettingsScreen({ screen: SettingsScreens.PrivacyGifts })}
        >
          <div className="multiline-item">
            <span className="title">{lang('PrivacyGifts')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(privacy.gifts)}
            </span>
          </div>
        </ListItem>
        <ListItem
          narrow
          className="no-icon"
          onClick={() => openSettingsScreen({ screen: SettingsScreens.PrivacySavedMusic })}
        >
          <div className="multiline-item">
            <span className="title">{lang('PrivacyMusic')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(privacy.savedMusic)}
            </span>
          </div>
        </ListItem>
        <ListItem
          narrow
          className="no-icon"
          onClick={() => openSettingsScreen({ screen: SettingsScreens.PrivacyForwarding })}
        >
          <div className="multiline-item">
            <span className="title">{lang('PrivacyForwardsTitle')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(privacy.forwards)}
            </span>
          </div>
        </ListItem>
        <ListItem
          narrow
          className="no-icon"
          onClick={() => openSettingsScreen({ screen: SettingsScreens.PrivacyPhoneCall })}
        >
          <div className="multiline-item">
            <span className="title">{lang('WhoCanCallMe')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(privacy.phoneCall)}
            </span>
          </div>
        </ListItem>
        <ListItem
          narrow
          allowDisabledClick
          rightElement={isCurrentUserPremium && <StarIcon size="big" type="premium" />}
          className="no-icon"
          onClick={() => openSettingsScreen({ screen: SettingsScreens.PrivacyVoiceMessages })}
        >
          <div className="multiline-item">
            <span className="title">{lang('PrivacyVoiceMessagesTitle')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(privacy.voiceMessages)}
            </span>
          </div>
        </ListItem>
        <ListItem
          narrow
          rightElement={isCurrentUserPremium && <StarIcon size="big" type="premium" />}
          className="no-icon"
          onClick={() => openSettingsScreen({ screen: SettingsScreens.PrivacyMessages })}
        >
          <div className="multiline-item">
            <span className="title">{lang('PrivacyMessagesTitle')}</span>
            <span className="subtitle" dir="auto">
              {shouldChargeForMessages ? lang('PrivacyPaidMessagesValue')
                : shouldNewNonContactPeersRequirePremium
                  ? lang('PrivacyMessagesContactsAndPremium')
                  : lang('P2PEverybody')}
            </span>
          </div>
        </ListItem>
        <ListItem
          narrow
          className="no-icon"
          onClick={() => openSettingsScreen({ screen: SettingsScreens.PrivacyGroupChats })}
        >
          <div className="multiline-item">
            <span className="title">{lang('WhoCanAddMe')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(privacy.chatInvite)}
            </span>
          </div>
        </ListItem>
      </Island>

      {canChangeSensitive && (
        <>
          <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>
            {lang('SettingsSensitiveTitle')}
          </IslandTitle>
          <Island>
            <Checkbox
              label={lang('SettingsSensitiveDisableFiltering')}
              subLabel={lang('SettingsSensitiveAbout')}
              checked={Boolean(isSensitiveEnabled)}
              disabled={!canChangeSensitive || (!isSensitiveEnabled && needAgeVideoVerification)}
              onCheck={handleUpdateContentSettings}
            />
            {!isSensitiveEnabled && needAgeVideoVerification && (
              <Button
                color="primary"
                noForcedUpperCase
                className="settings-unlock-button"
                onClick={handleAgeVerification}
              >
                <span className="settings-unlock-button-title">
                  {lang('ButtonAgeVerification')}
                </span>
              </Button>
            )}
          </Island>
        </>
      )}

      {canDisplayAutoarchiveSetting && (
        <>
          <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>
            {lang('NewChatsFromNonContacts')}
          </IslandTitle>
          <Island>
            <Checkbox
              label={lang('ArchiveAndMute')}
              subLabel={lang('ArchiveAndMuteInfo')}
              checked={Boolean(shouldArchiveAndMuteNewNonContact)}
              onCheck={handleArchiveAndMuteChange}
            />
          </Island>
        </>
      )}

      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>
        {lang('SettingsWindowSystem')}
      </IslandTitle>
      <Island>
        <Checkbox
          label={lang('SettingsTitleChatName')}
          checked={Boolean(canDisplayChatInTitle)}
          onCheck={handleChatInTitleChange}
        />
      </Island>

      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>
        {lang('DeleteMyAccount')}
      </IslandTitle>
      <Island>
        <ListItem
          narrow
          onClick={handleOpenDeleteAccountModal}
        >
          {lang('DeleteAccountIfAwayFor')}
          <span className="settings-item__current-value">
            {lang('Months', { count: dayOption }, { pluralValue: 1 })}
          </span>
        </ListItem>
      </Island>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const {
      settings: {
        byKey: {
          hasPassword, isSensitiveEnabled, canChangeSensitive, shouldArchiveAndMuteNewNonContact,
          shouldNewNonContactPeersRequirePremium, nonContactPeersPaidStars, defaultHistoryTtl,
        },
        privacy,
        accountDaysTtl,
        passkeys,
      },
      blocked,
      passcode: {
        hasPasscode,
      },
      appConfig,
    } = global;

    const { canDisplayChatInTitle } = selectSharedSettings(global);
    const shouldChargeForMessages = Boolean(nonContactPeersPaidStars);
    const isCurrentUserFrozen = selectIsCurrentUserFrozen(global);
    const isCurrentUserPremium = selectIsCurrentUserPremium(global);

    return {
      isCurrentUserPremium,
      hasPassword,
      hasPasscode: Boolean(hasPasscode),
      blockedCount: blocked.totalCount,
      webAuthCount: global.activeWebSessions.orderedHashes.length,
      isSensitiveEnabled,
      canDisplayAutoarchiveSetting: appConfig.canDisplayAutoarchiveSetting || isCurrentUserPremium,
      shouldArchiveAndMuteNewNonContact,
      canChangeSensitive,
      shouldNewNonContactPeersRequirePremium,
      shouldChargeForMessages,
      needAgeVideoVerification: Boolean(appConfig.needAgeVideoVerification),
      privacy,
      canDisplayChatInTitle,
      canSetPasscode: selectCanSetPasscode(global),
      isCurrentUserFrozen,
      accountDaysTtl,
      defaultHistoryTtl,
      passkeyCount: passkeys?.length,
      arePasskeysAvailable: appConfig.arePasskeysAvailable,
    };
  },
)(SettingsPrivacy));
