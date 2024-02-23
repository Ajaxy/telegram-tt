import React, { memo, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { selectIsCurrentUserPremium, selectNewNoncontactPeersRequirePremium } from '../../../global/selectors';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import RadioGroup from '../../ui/RadioGroup';
import PremiumStatusItem from './PremiumStatusItem';
import PrivacyLockedOption from './PrivacyLockedOption';

type OwnProps = {
  isActive?: boolean;
  onReset: VoidFunction;
};

type StateProps = {
  shouldNewNonContactPeersRequirePremium?: boolean;
  isCurrentUserPremium?: boolean;
};

function PrivacyMessages({
  isActive, onReset, shouldNewNonContactPeersRequirePremium, isCurrentUserPremium,
}: OwnProps & StateProps) {
  const { updateGlobalPrivacySettings } = getActions();
  const lang = useLang();

  const options = useMemo(() => {
    return [
      { value: 'everybody', label: lang('P2PEverybody') },
      {
        value: 'contacts_and_premium',
        label: isCurrentUserPremium ? (
          lang('PrivacyMessagesContactsAndPremium')
        ) : (
          <PrivacyLockedOption label={lang('PrivacyMessagesContactsAndPremium')} />
        ),
        hidden: !isCurrentUserPremium,
      },
    ];
  }, [lang, isCurrentUserPremium]);

  const handleChange = useLastCallback((privacy: string) => {
    updateGlobalPrivacySettings({ shouldNewNonContactPeersRequirePremium: privacy === 'contacts_and_premium' });
  });

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  return (
    <>
      <div className="settings-item">
        <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>
          {lang('PrivacyMessagesTitle')}
        </h4>
        <RadioGroup
          name="privacy-messages"
          options={options}
          onChange={handleChange}
          selected={shouldNewNonContactPeersRequirePremium ? 'contacts_and_premium' : 'everybody'}
        />
        <p className="settings-item-description-larger" dir={lang.isRtl ? 'rtl' : undefined}>
          {lang('Privacy.Messages.SectionFooter')}
        </p>
      </div>
      {!isCurrentUserPremium && <PremiumStatusItem />}
    </>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  return {
    shouldNewNonContactPeersRequirePremium: selectNewNoncontactPeersRequirePremium(global),
    isCurrentUserPremium: selectIsCurrentUserPremium(global),
  };
})(PrivacyMessages));
