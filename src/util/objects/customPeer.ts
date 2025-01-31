import type { UniqueCustomPeer } from '../../types';

export const CUSTOM_PEER_PREMIUM: UniqueCustomPeer = {
  isCustomPeer: true,
  type: 'premium',
  titleKey: 'PrivacyPremium',
  subtitleKey: 'PrivacyPremiumText',
  avatarIcon: 'star',
  isAvatarSquare: true,
  withPremiumGradient: true,
};

export const CUSTOM_PEER_INCLUDED_CHAT_TYPES: UniqueCustomPeer[] = [
  {
    isCustomPeer: true,
    type: 'contacts',
    titleKey: 'FilterContacts',
    avatarIcon: 'user',
    isAvatarSquare: true,
    peerColorId: 5,
  },
  {
    isCustomPeer: true,
    type: 'nonContacts',
    titleKey: 'FilterNonContacts',
    avatarIcon: 'non-contacts',
    isAvatarSquare: true,
    peerColorId: 4,
  },
  {
    isCustomPeer: true,
    type: 'groups',
    titleKey: 'FilterGroups',
    avatarIcon: 'group',
    isAvatarSquare: true,
    peerColorId: 3,
  },
  {
    isCustomPeer: true,
    type: 'channels',
    titleKey: 'FilterChannels',
    avatarIcon: 'channel',
    isAvatarSquare: true,
    peerColorId: 1,
  },
  {
    isCustomPeer: true,
    type: 'bots',
    titleKey: 'FilterBots',
    avatarIcon: 'bots',
    isAvatarSquare: true,
    peerColorId: 6,
  },
];

export const CUSTOM_PEER_EXCLUDED_CHAT_TYPES: UniqueCustomPeer[] = [
  {
    isCustomPeer: true,
    type: 'excludeMuted',
    titleKey: 'FilterMuted',
    avatarIcon: 'mute',
    isAvatarSquare: true,
    peerColorId: 6,
  },
  {
    isCustomPeer: true,
    type: 'excludeRead',
    titleKey: 'FilterRead',
    avatarIcon: 'readchats',
    isAvatarSquare: true,
    peerColorId: 4,
  },
  {
    isCustomPeer: true,
    type: 'excludeArchived',
    titleKey: 'FilterArchived',
    avatarIcon: 'archive',
    isAvatarSquare: true,
    peerColorId: 5,
  },
];

export const CUSTOM_PEER_HIDDEN: UniqueCustomPeer<'hidden'> = {
  isCustomPeer: true,
  type: 'hidden',
  titleKey: 'StarsTransactionHidden',
  avatarIcon: 'author-hidden',
  peerColorId: 4,
};
