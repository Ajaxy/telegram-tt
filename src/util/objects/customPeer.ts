import type { CustomPeer } from '../../types';

export const CUSTOM_PEER_PREMIUM: CustomPeer = {
  isCustomPeer: true,
  type: 'premium',
  titleKey: 'PrivacyPremium',
  subtitleKey: 'PrivacyPremiumText',
  avatarIcon: 'premium',
  isAvatarSquare: true,
  withPremiumGradient: true,
};

export const CUSTOM_PEER_TO_BE_DISTRIBUTED: CustomPeer = {
  isCustomPeer: true,
  type: 'toBeDistributed',
  titleKey: 'BoostingToBeDistributed',
  avatarIcon: 'user',
  withPremiumGradient: true,
};
