import React, {
  memo, useCallback, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { SettingsScreens } from '../../../types';

import {
  DEFAULT_CHARGE_FOR_MESSAGES,
} from '../../../config';
import {
  selectIsCurrentUserPremium,
  selectNewNoncontactPeersRequirePremium,
  selectNonContactPeersPaidStars,
} from '../../../global/selectors';

import useDebouncedCallback from '../../../hooks/useDebouncedCallback';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import PaidMessagePrice from '../../common/paidMessage/PaidMessagePrice';
import ListItem from '../../ui/ListItem';
import RadioGroup from '../../ui/RadioGroup';
import PremiumStatusItem from './PremiumStatusItem';
import PrivacyLockedOption from './PrivacyLockedOption';

type OwnProps = {
  isActive?: boolean;
  onReset: VoidFunction;
  onScreenSelect: (screen: SettingsScreens) => void;
};

type StateProps = {
  shouldNewNonContactPeersRequirePremium?: boolean;
  shouldChargeForMessages?: boolean;
  canLimitNewMessagesWithoutPremium?: boolean;
  canChargeForMessages?: boolean;
  isCurrentUserPremium?: boolean;
  nonContactPeersPaidStars: number;
  noPaidReactionsForUsersCount: number;
};

function PrivacyMessages({
  isActive,
  canLimitNewMessagesWithoutPremium,
  canChargeForMessages,
  shouldNewNonContactPeersRequirePremium,
  shouldChargeForMessages,
  nonContactPeersPaidStars,
  isCurrentUserPremium,
  noPaidReactionsForUsersCount,
  onReset,
  onScreenSelect,
}: OwnProps & StateProps) {
  const { updateGlobalPrivacySettings } = getActions();
  const oldLang = useOldLang();
  const lang = useLang();

  const canChangeForContactsAndPremium = isCurrentUserPremium || canLimitNewMessagesWithoutPremium;
  const canChangeChargeForMessages = isCurrentUserPremium && canChargeForMessages;
  const [chargeForMessages, setChargeForMessages] = useState<number>(nonContactPeersPaidStars);

  const selectedValue = useMemo(() => {
    if (shouldChargeForMessages) return 'charge_for_messages';
    if (shouldNewNonContactPeersRequirePremium) return 'contacts_and_premium';
    return 'everybody';
  }, [shouldChargeForMessages, shouldNewNonContactPeersRequirePremium]);

  const options = useMemo(() => {
    return [
      { value: 'everybody', label: oldLang('P2PEverybody') },
      {
        value: 'contacts_and_premium',
        label: canChangeForContactsAndPremium ? (
          oldLang('PrivacyMessagesContactsAndPremium')
        ) : (
          <PrivacyLockedOption
            label={oldLang('PrivacyMessagesContactsAndPremium')}
            isChecked={selectedValue === 'contacts_and_premium'}
          />
        ),
        hidden: !canChangeForContactsAndPremium,
        isCanCheckedInDisabled: true,
      },
      {
        value: 'charge_for_messages',
        label: canChangeChargeForMessages ? (
          lang('PrivacyChargeForMessages')
        ) : (
          <PrivacyLockedOption
            label={lang('PrivacyChargeForMessages')}
            isChecked={selectedValue === 'charge_for_messages'}
          />
        ),
        hidden: !canChangeChargeForMessages,
        isCanCheckedInDisabled: true,
      },
    ];
  }, [oldLang, lang, canChangeForContactsAndPremium, canChangeChargeForMessages, selectedValue]);

  const handleChange = useLastCallback((privacy: string) => {
    updateGlobalPrivacySettings({
      shouldNewNonContactPeersRequirePremium: privacy === 'contacts_and_premium',
      // eslint-disable-next-line no-null/no-null
      nonContactPeersPaidStars: privacy === 'charge_for_messages' ? chargeForMessages : null,
    });
  });

  const updateGlobalPrivacySettingsWithDebounced = useDebouncedCallback((value: number) => {
    updateGlobalPrivacySettings({
      nonContactPeersPaidStars: value,
    });
  }, [updateGlobalPrivacySettings], 300, true);

  const handleChargeForMessagesChange = useCallback((value: number) => {
    setChargeForMessages(value);
    updateGlobalPrivacySettingsWithDebounced(value);
  }, [setChargeForMessages, updateGlobalPrivacySettingsWithDebounced]);

  function renderSectionNoPaidMessagesForUsers() {
    const itemSubtitle = !noPaidReactionsForUsersCount ? lang('SubtitlePrivacyAddUsers')
      : oldLang('Users', noPaidReactionsForUsersCount, 'i');

    return (
      <div className="settings-item">
        <h4 className="settings-item-header" dir={oldLang.isRtl ? 'rtl' : undefined}>
          {lang('RemoveFeeTitle')}
        </h4>
        <ListItem
          narrow
          icon="delete-user"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => {
            onScreenSelect(SettingsScreens.PrivacyNoPaidMessages);
          }}
        >
          <div className="multiline-item full-size">
            <span className="title">{lang('ExceptionTitlePrivacyChargeForMessages')}</span>
            <span className="subtitle">{
              itemSubtitle
            }
            </span>
          </div>
        </ListItem>
      </div>
    );
  }

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const privacyDescription = useMemo(() => {
    if (shouldChargeForMessages) return lang('PrivacyDescriptionChargeForMessages');
    return lang('PrivacyDescriptionMessagesContactsAndPremium');
  }, [shouldChargeForMessages, lang]);

  return (
    <>
      <div className="settings-item">
        <h4 className="settings-item-header" dir={oldLang.isRtl ? 'rtl' : undefined}>
          {oldLang('PrivacyMessagesTitle')}
        </h4>
        <RadioGroup
          name="privacy-messages"
          options={options}
          onChange={handleChange}
          selected={selectedValue}
        />
        <p className="settings-item-description-larger" dir={oldLang.isRtl ? 'rtl' : undefined}>
          {privacyDescription}
        </p>
      </div>
      {selectedValue === 'charge_for_messages' && (
        <div className="settings-item fluid-container">
          <PaidMessagePrice
            canChangeChargeForMessages={canChangeChargeForMessages}
            chargeForMessages={chargeForMessages}
            onChange={handleChargeForMessagesChange}
          />
        </div>
      )}
      {canChangeChargeForMessages && selectedValue === 'charge_for_messages' && renderSectionNoPaidMessagesForUsers()}
      {!isCurrentUserPremium && selectedValue !== 'charge_for_messages'
      && <PremiumStatusItem premiumSection="message_privacy" />}
    </>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const nonContactPeersPaidStars = selectNonContactPeersPaidStars(global);

  const noPaidReactionsForUsersCount = global.settings.privacy.noPaidMessages?.allowUserIds.length || 0;

  return {
    shouldNewNonContactPeersRequirePremium: selectNewNoncontactPeersRequirePremium(global),
    shouldChargeForMessages: Boolean(nonContactPeersPaidStars),
    nonContactPeersPaidStars: nonContactPeersPaidStars || DEFAULT_CHARGE_FOR_MESSAGES,
    isCurrentUserPremium: selectIsCurrentUserPremium(global),
    canLimitNewMessagesWithoutPremium: global.appConfig?.canLimitNewMessagesWithoutPremium,
    canChargeForMessages: global.appConfig?.starsPaidMessagesAvailable,
    noPaidReactionsForUsersCount,
  };
})(PrivacyMessages));
