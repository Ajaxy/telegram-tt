import React, { memo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiPremiumSection } from '../../../api/types';

import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import StarIcon from '../../common/icons/StarIcon';
import ListItem from '../../ui/ListItem';

type OwnProps = {
  premiumSection?: ApiPremiumSection;
};

function PremiumStatusItem({ premiumSection }: OwnProps) {
  const { openPremiumModal } = getActions();
  const lang = useOldLang();
  const handleOpenPremiumModal = useLastCallback(() => openPremiumModal({ initialSection: premiumSection }));

  return (
    <div className="settings-item">
      <ListItem
        leftElement={<StarIcon className="icon ListItem-main-icon" type="premium" size="big" />}
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
