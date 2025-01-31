import type { ApiChat } from './chats';
import type { ApiUser } from './users';

export type ApiPrivacyKey = 'phoneNumber' | 'addByPhone' | 'lastSeen' | 'profilePhoto' | 'voiceMessages' |
'forwards' | 'chatInvite' | 'phoneCall' | 'phoneP2P' | 'bio' | 'birthday' | 'gifts';
export type PrivacyVisibility = 'everybody' | 'contacts' | 'closeFriends' | 'nonContacts' | 'nobody';
export type BotsPrivacyType = 'allow' | 'disallow' | 'none';

export interface ApiPrivacySettings {
  visibility: PrivacyVisibility;
  isUnspecified?: boolean;
  allowUserIds: string[];
  allowChatIds: string[];
  blockUserIds: string[];
  blockChatIds: string[];
  shouldAllowPremium?: true;
  botsPrivacy: BotsPrivacyType;
}

export interface ApiInputPrivacyRules {
  visibility: PrivacyVisibility;
  isUnspecified?: boolean;
  allowedUsers?: ApiUser[];
  allowedChats?: ApiChat[];
  blockedUsers?: ApiUser[];
  blockedChats?: ApiChat[];
  shouldAllowPremium?: true;
  botsPrivacy: BotsPrivacyType;
}

export interface ApiLanguage {
  isOfficial?: true;
  isRtl?: true;
  isBeta?: true;
  name: string;
  nativeName: string;
  langCode: string;
  baseLangCode?: string;
  pluralCode: string;
  stringsCount: number;
  translatedCount: number;
  translationsUrl: string;
}

export type ApiOldLangString = string | {
  zeroValue?: string;
  oneValue?: string;
  twoValue?: string;
  fewValue?: string;
  manyValue?: string;
  otherValue?: string;
};

export type ApiOldLangPack = Record<string, ApiOldLangString | undefined>;

export type LangPack = {
  langCode: string;
  version: number;
  strings: Record<string, LangPackStringValue>;
};

export type CachedLangData = {
  langPack: LangPack;
  language: ApiLanguage;
};

export type LangPackStringValueRegular = string;
export type LangPackStringValueDeleted = {
  isDeleted: true;
};
export type LangPackStringValuePlural = {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
};

export type LangPackStringValue = LangPackStringValueRegular | LangPackStringValueDeleted | LangPackStringValuePlural;
