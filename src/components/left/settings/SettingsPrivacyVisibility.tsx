import type { FC } from '../../../lib/teact/teact';
import { memo, useCallback, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiPhoto, ApiPrivacySettings, BotsPrivacyType } from '../../../api/types';
import { SettingsScreens } from '../../../types';

import { selectIsCurrentUserPremium, selectUserFullInfo } from '../../../global/selectors';
import { getPrivacyKey } from './helpers/privacy';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Icon from '../../common/icons/Icon';
import ListItem from '../../ui/ListItem';
import RadioGroup from '../../ui/RadioGroup';
import Switcher from '../../ui/Switcher';
import PremiumStatusItem from './PremiumStatusItem';
import PrivacyLockedOption from './PrivacyLockedOption';
import SettingsAcceptedGift from './SettingsAcceptedGift';
import SettingsPrivacyLastSeen from './SettingsPrivacyLastSeen';
import SettingsPrivacyPublicProfilePhoto from './SettingsPrivacyPublicProfilePhoto';

type OwnProps = {
  screen: SettingsScreens;
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = {
  currentUserId: string;
  hasCurrentUserFullInfo?: boolean;
  currentUserFallbackPhoto?: ApiPhoto;
  primaryPrivacy?: ApiPrivacySettings;
  secondaryPrivacy?: ApiPrivacySettings;
  isPremiumRequired?: boolean;
  shouldDisplayGiftsButton?: boolean;
  isCurrentUserPremium?: boolean;
};

const SettingsPrivacyVisibility: FC<OwnProps & StateProps> = ({
  screen,
  isActive,
  primaryPrivacy,
  secondaryPrivacy,
  currentUserId,
  hasCurrentUserFullInfo,
  currentUserFallbackPhoto,
  isPremiumRequired,
  onReset,
  shouldDisplayGiftsButton,
  isCurrentUserPremium,
}) => {
  const { updateGlobalPrivacySettings, showNotification } = getActions();

  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const handleShowGiftIconInChats = useLastCallback(() => {
    if (!isCurrentUserPremium) {
      showNotification({
        message: lang('PrivacySubscribeToTelegramPremium'),
        action: {
          action: 'openPremiumModal',
          payload: {},
        },
        actionText: { key: 'Open' },
        icon: 'star',
      });
      return;
    }
    updateGlobalPrivacySettings({
      shouldDisplayGiftsButton: !shouldDisplayGiftsButton,
    });
  });

  const secondaryScreen = useMemo(() => {
    switch (screen) {
      case SettingsScreens.PrivacyPhoneCall:
        return SettingsScreens.PrivacyPhoneP2P;
      case SettingsScreens.PrivacyPhoneNumber: {
        return primaryPrivacy?.visibility === 'nobody' ? SettingsScreens.PrivacyAddByPhone : undefined;
      }
      default:
        return undefined;
    }
  }, [primaryPrivacy, screen]);

  return (
    <div className="settings-content custom-scroll">
      {screen === SettingsScreens.PrivacyGifts && (
        <div className="settings-item">
          <ListItem onClick={handleShowGiftIconInChats}>
            <span>{lang('PrivacyDisplayGiftsButton')}</span>
            <Switcher
              id="gift"
              disabled={!isCurrentUserPremium}
              label={shouldDisplayGiftsButton ? lang('HideGiftsButton') : lang('DisplayGiftsButton')}
              checked={shouldDisplayGiftsButton}
            />
          </ListItem>
          <p className="settings-item-description-larger" dir={lang.isRtl ? 'rtl' : undefined}>
            {lang('PrivacyDisplayGiftIconInChats', {
              icon: <Icon name="gift" className="gift-icon" />,
              gift: lang('PrivacyDisplayGift'),
            }, {
              withNodes: true,
            })}
          </p>
        </div>
      )}
      <PrivacySubsection
        screen={screen}
        privacy={primaryPrivacy}
        isPremiumRequired={isPremiumRequired}
      />
      {screen === SettingsScreens.PrivacyProfilePhoto && primaryPrivacy?.visibility !== 'everybody' && (
        <SettingsPrivacyPublicProfilePhoto
          currentUserId={currentUserId}
          hasCurrentUserFullInfo={hasCurrentUserFullInfo}
          currentUserFallbackPhoto={currentUserFallbackPhoto}
        />
      )}
      {screen === SettingsScreens.PrivacyLastSeen && (
        <SettingsPrivacyLastSeen visibility={primaryPrivacy?.visibility} />
      )}
      {screen === SettingsScreens.PrivacyGifts && (
        <SettingsAcceptedGift />
      )}
      {Boolean(secondaryScreen) && (
        <PrivacySubsection
          screen={secondaryScreen}
          privacy={secondaryPrivacy}
        />
      )}
    </div>
  );
};

function PrivacySubsection({
  screen,
  privacy,
  isPremiumRequired,
}: {
  screen: SettingsScreens;
  privacy?: ApiPrivacySettings;
  isPremiumRequired?: boolean;
}) {
  const { setPrivacyVisibility, openSettingsScreen } = getActions();
  const oldLang = useOldLang();
  const lang = useLang();

  const visibilityOptions = useMemo(() => {
    const hasNobody = screen !== SettingsScreens.PrivacyAddByPhone;
    const options = [
      { value: 'everybody', label: oldLang('P2PEverybody') },
      {
        value: 'contacts',
        label: isPremiumRequired ? (
          <PrivacyLockedOption label={oldLang('P2PContacts')} />
        ) : (
          oldLang('P2PContacts')
        ),
        hidden: isPremiumRequired,
      },
    ];

    if (hasNobody) {
      options.push({
        value: 'nobody',
        label: isPremiumRequired ? (
          <PrivacyLockedOption label={oldLang('P2PNobody')} />
        ) : (
          oldLang('P2PNobody')
        ),
        hidden: isPremiumRequired,
      });
    }
    return options;
  }, [oldLang, screen, isPremiumRequired]);

  const primaryExceptionLists = useMemo(() => {
    if (screen === SettingsScreens.PrivacyAddByPhone) {
      return {
        shouldShowDenied: false,
        shouldShowAllowed: false,
      };
    }

    return {
      shouldShowDenied: privacy?.visibility !== 'nobody',
      shouldShowAllowed: privacy?.visibility !== 'everybody',
    };
  }, [privacy, screen]);

  const privacyKey = getPrivacyKey(screen);

  const descriptionText = useMemo(() => {
    switch (screen) {
      case SettingsScreens.PrivacyGifts:
        return lang('PrivacyGiftsInfo');
      case SettingsScreens.PrivacyLastSeen:
        return oldLang('CustomHelp');
      case SettingsScreens.PrivacyAddByPhone: {
        return privacy?.visibility === 'everybody' ? oldLang('PrivacyPhoneInfo') : oldLang('PrivacyPhoneInfo3');
      }
      case SettingsScreens.PrivacyVoiceMessages:
        return oldLang('PrivacyVoiceMessagesInfo');
      default:
        return undefined;
    }
  }, [oldLang, lang, screen, privacy]);

  const headerText = useMemo(() => {
    switch (screen) {
      case SettingsScreens.PrivacyPhoneNumber:
        return oldLang('PrivacyPhoneTitle');
      case SettingsScreens.PrivacyAddByPhone:
        return oldLang('PrivacyPhoneTitle2');
      case SettingsScreens.PrivacyLastSeen:
        return oldLang('LastSeenTitle');
      case SettingsScreens.PrivacyProfilePhoto:
        return oldLang('PrivacyProfilePhotoTitle');
      case SettingsScreens.PrivacyBio:
        return oldLang('PrivacyBioTitle');
      case SettingsScreens.PrivacyBirthday:
        return oldLang('PrivacyBirthdayTitle');
      case SettingsScreens.PrivacyGifts:
        return lang('PrivacyGiftsTitle');
      case SettingsScreens.PrivacyForwarding:
        return oldLang('PrivacyForwardsTitle');
      case SettingsScreens.PrivacyVoiceMessages:
        return oldLang('PrivacyVoiceMessagesTitle');
      case SettingsScreens.PrivacyGroupChats:
        return oldLang('WhoCanAddMe');
      case SettingsScreens.PrivacyPhoneCall:
        return oldLang('WhoCanCallMe');
      case SettingsScreens.PrivacyPhoneP2P:
        return oldLang('PrivacyP2P');
      default:
        return undefined;
    }
  }, [oldLang, lang, screen]);

  const prepareSubtitle = useLastCallback(
    (userIds?: string[], chatIds?: string[], shouldAllowPremium?: boolean, botsPrivacy?: BotsPrivacyType) => {
      const userIdsCount = userIds?.length || 0;
      const chatIdsCount = chatIds?.length || 0;
      const isAllowBots = botsPrivacy === 'allow';
      const hasPeers = userIdsCount || chatIdsCount;

      if (!hasPeers && !isAllowBots) {
        return shouldAllowPremium ? oldLang('PrivacyPremium') : oldLang('EditAdminAddUsers');
      } else if (shouldAllowPremium) {
        return oldLang('ContactsAndPremium');
      }

      const userCountString = userIdsCount > 0 ? oldLang('Users', userIdsCount) : undefined;
      const chatCountString = chatIdsCount > 0 ? oldLang('Chats', chatIdsCount) : undefined;

      const botPrivacyString = isAllowBots ? lang('PrivacyValueBots') : '';
      const peersString = lang.conjunction([userCountString, chatCountString].filter(Boolean));

      return [botPrivacyString, peersString].filter(Boolean).join(' ');
    },
  );

  const allowedString = useMemo(() => {
    return prepareSubtitle(
      privacy?.allowUserIds,
      privacy?.allowChatIds,
      privacy?.shouldAllowPremium,
      privacy?.botsPrivacy,
    );
  }, [privacy]);

  const blockString = useMemo(() => {
    return prepareSubtitle(privacy?.blockUserIds, privacy?.blockChatIds);
  }, [privacy]);

  const handleVisibilityChange = useCallback((value) => {
    setPrivacyVisibility({
      privacyKey: privacyKey!,
      visibility: value,
    });
  }, [privacyKey]);

  const allowedContactsScreen = (() => {
    switch (screen) {
      case SettingsScreens.PrivacyPhoneNumber:
        return SettingsScreens.PrivacyPhoneNumberAllowedContacts;
      case SettingsScreens.PrivacyLastSeen:
        return SettingsScreens.PrivacyLastSeenAllowedContacts;
      case SettingsScreens.PrivacyProfilePhoto:
        return SettingsScreens.PrivacyProfilePhotoAllowedContacts;
      case SettingsScreens.PrivacyBio:
        return SettingsScreens.PrivacyBioAllowedContacts;
      case SettingsScreens.PrivacyBirthday:
        return SettingsScreens.PrivacyBirthdayAllowedContacts;
      case SettingsScreens.PrivacyGifts:
        return SettingsScreens.PrivacyGiftsAllowedContacts;
      case SettingsScreens.PrivacyForwarding:
        return SettingsScreens.PrivacyForwardingAllowedContacts;
      case SettingsScreens.PrivacyPhoneCall:
        return SettingsScreens.PrivacyPhoneCallAllowedContacts;
      case SettingsScreens.PrivacyPhoneP2P:
        return SettingsScreens.PrivacyPhoneP2PAllowedContacts;
      case SettingsScreens.PrivacyVoiceMessages:
        return SettingsScreens.PrivacyVoiceMessagesAllowedContacts;
      default:
        return SettingsScreens.PrivacyGroupChatsAllowedContacts;
    }
  })();

  const deniedContactsScreen = (() => {
    switch (screen) {
      case SettingsScreens.PrivacyPhoneNumber:
        return SettingsScreens.PrivacyPhoneNumberDeniedContacts;
      case SettingsScreens.PrivacyLastSeen:
        return SettingsScreens.PrivacyLastSeenDeniedContacts;
      case SettingsScreens.PrivacyProfilePhoto:
        return SettingsScreens.PrivacyProfilePhotoDeniedContacts;
      case SettingsScreens.PrivacyBio:
        return SettingsScreens.PrivacyBioDeniedContacts;
      case SettingsScreens.PrivacyBirthday:
        return SettingsScreens.PrivacyBirthdayDeniedContacts;
      case SettingsScreens.PrivacyGifts:
        return SettingsScreens.PrivacyGiftsDeniedContacts;
      case SettingsScreens.PrivacyForwarding:
        return SettingsScreens.PrivacyForwardingDeniedContacts;
      case SettingsScreens.PrivacyPhoneCall:
        return SettingsScreens.PrivacyPhoneCallDeniedContacts;
      case SettingsScreens.PrivacyPhoneP2P:
        return SettingsScreens.PrivacyPhoneP2PDeniedContacts;
      case SettingsScreens.PrivacyVoiceMessages:
        return SettingsScreens.PrivacyVoiceMessagesDeniedContacts;
      default:
        return SettingsScreens.PrivacyGroupChatsDeniedContacts;
    }
  })();

  return (
    <>
      <div className="settings-item">
        <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>{headerText}</h4>
        <RadioGroup
          name={`visibility-${privacyKey}`}
          options={visibilityOptions}
          onChange={handleVisibilityChange}
          selected={privacy?.visibility}
        />
        {descriptionText && (
          <p className="settings-item-description-larger" dir={lang.isRtl ? 'rtl' : undefined}>{descriptionText}</p>
        )}
      </div>
      {!isPremiumRequired && (primaryExceptionLists.shouldShowAllowed || primaryExceptionLists.shouldShowDenied) && (
        <div className="settings-item">
          <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>
            {oldLang('PrivacyExceptions')}
          </h4>
          {primaryExceptionLists.shouldShowAllowed && (
            <ListItem
              narrow
              icon="add-user"

              onClick={() => {
                openSettingsScreen({ screen: allowedContactsScreen });
              }}
            >
              <div className="multiline-item full-size">
                <span className="title">{oldLang('AlwaysAllow')}</span>
                <span className="subtitle">{allowedString}</span>
              </div>
            </ListItem>
          )}
          {primaryExceptionLists.shouldShowDenied && (
            <ListItem
              narrow
              icon="delete-user"

              onClick={() => {
                openSettingsScreen({ screen: deniedContactsScreen });
              }}
            >
              <div className="multiline-item full-size">
                <span className="title">{oldLang('NeverAllow')}</span>
                <span className="subtitle">{blockString}</span>
              </div>
            </ListItem>
          )}
        </div>
      )}
      {isPremiumRequired && <PremiumStatusItem />}
    </>
  );
}

export default memo(withGlobal<OwnProps>(
  (global, { screen }): Complete<StateProps> => {
    let primaryPrivacy: ApiPrivacySettings | undefined;
    let secondaryPrivacy: ApiPrivacySettings | undefined;

    const {
      currentUserId,
      settings: {
        privacy,
        byKey: {
          shouldDisplayGiftsButton,
        },
      },
    } = global;

    const currentUserFullInfo = selectUserFullInfo(global, currentUserId!);

    switch (screen) {
      case SettingsScreens.PrivacyPhoneNumber:
        primaryPrivacy = privacy.phoneNumber;
        secondaryPrivacy = privacy.addByPhone;
        break;

      case SettingsScreens.PrivacyLastSeen:
        primaryPrivacy = privacy.lastSeen;
        break;

      case SettingsScreens.PrivacyProfilePhoto:
        primaryPrivacy = privacy.profilePhoto;
        break;

      case SettingsScreens.PrivacyBio:
        primaryPrivacy = privacy.bio;
        break;

      case SettingsScreens.PrivacyBirthday:
        primaryPrivacy = privacy.birthday;
        break;

      case SettingsScreens.PrivacyGifts:
        primaryPrivacy = privacy.gifts;
        break;

      case SettingsScreens.PrivacyPhoneP2P:
      case SettingsScreens.PrivacyPhoneCall:
        primaryPrivacy = privacy.phoneCall;
        secondaryPrivacy = privacy.phoneP2P;
        break;

      case SettingsScreens.PrivacyForwarding:
        primaryPrivacy = privacy.forwards;
        break;

      case SettingsScreens.PrivacyVoiceMessages:
        primaryPrivacy = privacy.voiceMessages;
        break;

      case SettingsScreens.PrivacyGroupChats:
        primaryPrivacy = privacy.chatInvite;
        break;
    }

    if (!primaryPrivacy) {
      return {
        currentUserId: currentUserId!,
        hasCurrentUserFullInfo: Boolean(currentUserFullInfo),
        currentUserFallbackPhoto: currentUserFullInfo?.fallbackPhoto,
      } as Complete<StateProps>;
    }

    return {
      primaryPrivacy,
      secondaryPrivacy,
      currentUserId: currentUserId!,
      hasCurrentUserFullInfo: Boolean(currentUserFullInfo),
      currentUserFallbackPhoto: currentUserFullInfo?.fallbackPhoto,
      isPremiumRequired: screen === SettingsScreens.PrivacyVoiceMessages && !selectIsCurrentUserPremium(global),
      shouldDisplayGiftsButton,
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
    };
  },
)(SettingsPrivacyVisibility));
