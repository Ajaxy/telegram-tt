import { memo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiPremiumSection } from '../../../api/types';

import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import StarIcon from '../../common/icons/StarIcon';
import Island, { IslandDescription } from '../../gili/layout/Island';
import ListItem from '../../ui/ListItem';

type OwnProps = {
  premiumSection?: ApiPremiumSection;
};

function PremiumStatusItem({ premiumSection }: OwnProps) {
  const { openPremiumModal } = getActions();
  const lang = useOldLang();
  const handleOpenPremiumModal = useLastCallback(() => openPremiumModal({ initialSection: premiumSection }));

  return (
    <>
      <Island>
        <ListItem
          leftElement={<StarIcon className="icon ListItem-main-icon" type="premium" size="big" />}
          onClick={handleOpenPremiumModal}
        >
          {lang('PrivacyLastSeenPremium')}
        </ListItem>
      </Island>
      <IslandDescription dir={lang.isRtl ? 'rtl' : undefined}>
        {lang('lng_messages_privacy_premium_about')}
      </IslandDescription>
    </>
  );
}

export default memo(PremiumStatusItem);
