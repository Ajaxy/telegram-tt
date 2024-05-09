import React, { memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { PrivacyVisibility } from '../../../types';

import { selectIsCurrentUserPremium, selectShouldHideReadMarks } from '../../../global/selectors';
import renderText from '../../common/helpers/renderText';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import PremiumIcon from '../../common/PremiumIcon';
import Checkbox from '../../ui/Checkbox';
import ListItem from '../../ui/ListItem';

type OwnProps = {
  visibility?: PrivacyVisibility;
};

type StateProps = {
  isCurrentUserPremium: boolean;
  shouldHideReadMarks: boolean;
};

const SettingsPrivacyLastSeen = ({
  isCurrentUserPremium, shouldHideReadMarks, visibility,
}: OwnProps & StateProps) => {
  const { updateGlobalPrivacySettings, openPremiumModal } = getActions();
  const lang = useLang();
  const canShowHideReadTime = visibility === 'nobody' || visibility === 'contacts';

  const handleChangeShouldHideReadMarks = useLastCallback(
    (isEnabled) => updateGlobalPrivacySettings({ shouldHideReadMarks: isEnabled }),
  );

  const handleOpenPremiumModal = useLastCallback(() => {
    openPremiumModal({
      initialSection: 'last_seen',
    });
  });

  return (
    <>
      {canShowHideReadTime && (
        <div className="settings-item">
          <Checkbox
            label={lang('HideReadTime')}
            checked={shouldHideReadMarks}
            onCheck={handleChangeShouldHideReadMarks}
          />
          <p className="settings-item-description-larger" dir={lang.isRtl ? 'rtl' : undefined}>
            {renderText(lang('HideReadTimeInfo'), ['br'])}
          </p>
        </div>
      )}
      <div className="settings-item">
        <ListItem
          leftElement={<PremiumIcon className="icon" withGradient big />}
          onClick={handleOpenPremiumModal}
        >
          {isCurrentUserPremium ? lang('PrivacyLastSeenPremiumForPremium') : lang('PrivacyLastSeenPremium')}
        </ListItem>
        <p
          className="settings-item-description-larger premium-info"
          dir={lang.isRtl ? 'rtl' : undefined}
        >
          {isCurrentUserPremium
            ? lang('PrivacyLastSeenPremiumInfoForPremium')
            : lang('PrivacyLastSeenPremiumInfo')}
        </p>
      </div>
    </>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    return {
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
      shouldHideReadMarks: Boolean(selectShouldHideReadMarks(global)),
    };
  },
)(SettingsPrivacyLastSeen));
