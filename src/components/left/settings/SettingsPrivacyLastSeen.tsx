import { memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { PrivacyVisibility } from '../../../api/types';

import { selectIsCurrentUserPremium, selectShouldHideReadMarks } from '../../../global/selectors';
import renderText from '../../common/helpers/renderText';

import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import StarIcon from '../../common/icons/StarIcon';
import Island, { IslandDescription } from '../../gili/layout/Island';
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
  const lang = useOldLang();
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
        <>
          <Island>
            <Checkbox
              label={lang('HideReadTime')}
              checked={shouldHideReadMarks}
              onCheck={handleChangeShouldHideReadMarks}
            />
          </Island>
          <IslandDescription dir={lang.isRtl ? 'rtl' : undefined}>
            {renderText(lang('HideReadTimeInfo'), ['br'])}
          </IslandDescription>
        </>
      )}
      <Island>
        <ListItem
          leftElement={<StarIcon className="icon ListItem-main-icon" type="premium" size="big" />}
          onClick={handleOpenPremiumModal}
        >
          {isCurrentUserPremium ? lang('PrivacyLastSeenPremiumForPremium') : lang('PrivacyLastSeenPremium')}
        </ListItem>
      </Island>
      <IslandDescription dir={lang.isRtl ? 'rtl' : undefined}>
        {isCurrentUserPremium
          ? lang('PrivacyLastSeenPremiumInfoForPremium')
          : lang('PrivacyLastSeenPremiumInfo')}
      </IslandDescription>
    </>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    return {
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
      shouldHideReadMarks: Boolean(selectShouldHideReadMarks(global)),
    };
  },
)(SettingsPrivacyLastSeen));
