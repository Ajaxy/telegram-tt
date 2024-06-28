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

export const CUSTOM_PEER_TO_BE_DISTRIBUTED: UniqueCustomPeer = {
  isCustomPeer: true,
  type: 'toBeDistributed',
  titleKey: 'BoostingToBeDistributed',
  avatarIcon: 'user',
  withPremiumGradient: true,
};
