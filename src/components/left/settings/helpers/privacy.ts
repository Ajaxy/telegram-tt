import type { ApiPrivacyKey } from '../../../../api/types';
import { SettingsScreens } from '../../../../types';

export function getPrivacyKey(screen: SettingsScreens): ApiPrivacyKey | undefined {
  switch (screen) {
    case SettingsScreens.PrivacyPhoneNumber:
    case SettingsScreens.PrivacyPhoneNumberAllowedContacts:
    case SettingsScreens.PrivacyPhoneNumberDeniedContacts:
      return 'phoneNumber';
    case SettingsScreens.PrivacyLastSeen:
    case SettingsScreens.PrivacyLastSeenAllowedContacts:
    case SettingsScreens.PrivacyLastSeenDeniedContacts:
      return 'lastSeen';
    case SettingsScreens.PrivacyProfilePhoto:
    case SettingsScreens.PrivacyProfilePhotoAllowedContacts:
    case SettingsScreens.PrivacyProfilePhotoDeniedContacts:
      return 'profilePhoto';
    case SettingsScreens.PrivacyBio:
    case SettingsScreens.PrivacyBioAllowedContacts:
    case SettingsScreens.PrivacyBioDeniedContacts:
      return 'bio';
    case SettingsScreens.PrivacyBirthday:
    case SettingsScreens.PrivacyBirthdayAllowedContacts:
    case SettingsScreens.PrivacyBirthdayDeniedContacts:
      return 'birthday';
    case SettingsScreens.PrivacyGifts:
    case SettingsScreens.PrivacyGiftsAllowedContacts:
    case SettingsScreens.PrivacyGiftsDeniedContacts:
      return 'gifts';
    case SettingsScreens.PrivacyForwarding:
    case SettingsScreens.PrivacyForwardingAllowedContacts:
    case SettingsScreens.PrivacyForwardingDeniedContacts:
      return 'forwards';
    case SettingsScreens.PrivacyVoiceMessages:
    case SettingsScreens.PrivacyVoiceMessagesAllowedContacts:
    case SettingsScreens.PrivacyVoiceMessagesDeniedContacts:
      return 'voiceMessages';
    case SettingsScreens.PrivacyGroupChats:
    case SettingsScreens.PrivacyGroupChatsAllowedContacts:
    case SettingsScreens.PrivacyGroupChatsDeniedContacts:
      return 'chatInvite';
    case SettingsScreens.PrivacyPhoneCall:
    case SettingsScreens.PrivacyPhoneCallAllowedContacts:
    case SettingsScreens.PrivacyPhoneCallDeniedContacts:
      return 'phoneCall';
    case SettingsScreens.PrivacyPhoneP2P:
    case SettingsScreens.PrivacyPhoneP2PAllowedContacts:
    case SettingsScreens.PrivacyPhoneP2PDeniedContacts:
      return 'phoneP2P';
    case SettingsScreens.PrivacyAddByPhone:
      return 'addByPhone';
  }

  return undefined;
}
