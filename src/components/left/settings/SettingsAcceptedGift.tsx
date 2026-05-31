import { memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiDisallowedGiftsSettings } from '../../../api/types';

import { selectIsCurrentUserPremium } from '../../../global/selectors';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Island, { IslandDescription, IslandTitle } from '../../gili/layout/Island';
import ListItem from '../../ui/ListItem';
import Switcher from '../../ui/Switcher';

type StateProps = {
  disallowedGifts?: ApiDisallowedGiftsSettings;
  isCurrentUserPremium: boolean;
};

const SettingsAcceptedGift = ({
  disallowedGifts, isCurrentUserPremium,
}: StateProps) => {
  const { showNotification, updateGlobalPrivacySettings } = getActions();

  const lang = useLang();

  const handleOpenTelegramPremiumModal = useLastCallback(() => {
    showNotification({
      message: lang('PrivacySubscribeToTelegramPremium'),
      action: {
        action: 'openPremiumModal',
        payload: {},
      },
      actionText: { key: 'Open' },
      icon: 'star',
    });
  });

  const handleLimitedEditionChange = useLastCallback(() => {
    if (!isCurrentUserPremium) {
      handleOpenTelegramPremiumModal();
      return;
    }

    updateGlobalPrivacySettings({
      disallowedGifts: {
        ...disallowedGifts,
        shouldDisallowLimitedStarGifts: !disallowedGifts?.shouldDisallowLimitedStarGifts || undefined,
      },
    });
  });

  const handleUnlimitedEditionChange = useLastCallback(() => {
    if (!isCurrentUserPremium) {
      handleOpenTelegramPremiumModal();
      return;
    }
    updateGlobalPrivacySettings({
      disallowedGifts: {
        ...disallowedGifts,
        shouldDisallowUnlimitedStarGifts: !disallowedGifts?.shouldDisallowUnlimitedStarGifts || undefined,
      },
    });
  });

  const handleUniqueChange = useLastCallback(() => {
    if (!isCurrentUserPremium) {
      handleOpenTelegramPremiumModal();
      return;
    }
    updateGlobalPrivacySettings({
      disallowedGifts: {
        ...disallowedGifts,
        shouldDisallowUniqueStarGifts: !disallowedGifts?.shouldDisallowUniqueStarGifts || undefined,
      },
    });
  });

  const handlePremiumSubscriptionChange = useLastCallback(() => {
    if (!isCurrentUserPremium) {
      handleOpenTelegramPremiumModal();
      return;
    }
    updateGlobalPrivacySettings({
      disallowedGifts: {
        ...disallowedGifts,
        shouldDisallowPremiumGifts: !disallowedGifts?.shouldDisallowPremiumGifts || undefined,
      },
    });
  });

  return (
    <>
      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>
        {lang('PrivacyAcceptedGiftTitle')}
      </IslandTitle>
      <Island>
        <ListItem onClick={handleLimitedEditionChange}>
          <span>{lang('PrivacyGiftLimitedEdition')}</span>
          <Switcher
            id="limited_edition"
            label={disallowedGifts?.shouldDisallowLimitedStarGifts ? lang('PrivacyDisableLimitedEditionStarGifts')
              : lang('PrivacyEnableLimitedEditionStarGifts')}
            disabled={!isCurrentUserPremium}
            checked={!isCurrentUserPremium ? true : !disallowedGifts?.shouldDisallowLimitedStarGifts}
          />
        </ListItem>
        <ListItem onClick={handleUnlimitedEditionChange}>
          <span>{lang('PrivacyGiftUnlimited')}</span>
          <Switcher
            id="unlimited"
            label={disallowedGifts?.shouldDisallowUnlimitedStarGifts ? lang('PrivacyDisableUnlimitedStarGifts')
              : lang('PrivacyEnableUnlimitedStarGifts')}
            disabled={!isCurrentUserPremium}
            checked={!isCurrentUserPremium ? true : !disallowedGifts?.shouldDisallowUnlimitedStarGifts}
          />
        </ListItem>
        <ListItem onClick={handleUniqueChange}>
          <span>{lang('PrivacyGiftUnique')}</span>
          <Switcher
            id="unique"
            label={disallowedGifts?.shouldDisallowUniqueStarGifts ? lang('PrivacyDisableUniqueStarGifts')
              : lang('PrivacyEnableUniqueStarGifts')}
            disabled={!isCurrentUserPremium}
            checked={!isCurrentUserPremium ? true : !disallowedGifts?.shouldDisallowUniqueStarGifts}
          />
        </ListItem>
        <ListItem onClick={handlePremiumSubscriptionChange}>
          <span>{lang('PrivacyGiftPremiumSubscription')}</span>
          <Switcher
            id="premium_subscription"
            label={disallowedGifts?.shouldDisallowPremiumGifts ? lang('PrivacyDisablePremiumGifts')
              : lang('PrivacyEnablePremiumGifts')}
            disabled={!isCurrentUserPremium}
            checked={!isCurrentUserPremium ? true : !disallowedGifts?.shouldDisallowPremiumGifts}
          />
        </ListItem>
      </Island>
      <IslandDescription dir={lang.isRtl ? 'rtl' : undefined}>
        {lang('PrivacyAcceptedGiftInfo')}
      </IslandDescription>
    </>
  );
};

export default memo(withGlobal(
  (global): Complete<StateProps> => {
    const {
      settings: {
        byKey: {
          disallowedGifts,
        },
      },
    } = global;

    return {
      disallowedGifts,
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
    };
  },
)(SettingsAcceptedGift));
