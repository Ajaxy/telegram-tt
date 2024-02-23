import React, { memo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import PremiumIcon from '../../common/PremiumIcon';
import ListItem from '../../ui/ListItem';

function PremiumStatusItem() {
  const { openPremiumModal } = getActions();
  const lang = useLang();
  const handleOpenPremiumModal = useLastCallback(() => openPremiumModal());

  return (
    <div className="settings-item">
      <ListItem
        leftElement={<PremiumIcon className="icon" withGradient big />}
        onClick={handleOpenPremiumModal}
      >
        {lang('PrivacyLastSeenPremium')}
      </ListItem>
      <p
        className="settings-item-description-larger premium-info"
        dir={lang.isRtl ? 'rtl' : undefined}
      >
        {lang('lng_messages_privacy_premium_about')}
      </p>
    </div>
  );
}

export default memo(PremiumStatusItem);
