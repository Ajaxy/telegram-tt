import { ApiPrivacyKey, SettingsScreens } from '../../../../types';

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
    case SettingsScreens.PrivacyForwarding:
    case SettingsScreens.PrivacyForwardingAllowedContacts:
    case SettingsScreens.PrivacyForwardingDeniedContacts:
      return 'forwards';
    case SettingsScreens.PrivacyGroupChats:
    case SettingsScreens.PrivacyGroupChatsAllowedContacts:
    case SettingsScreens.PrivacyGroupChatsDeniedContacts:
      return 'chatInvite';
  }

  return undefined;
}
