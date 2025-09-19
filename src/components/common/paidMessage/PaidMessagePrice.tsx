import {
  memo,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import {
  DEFAULT_MAXIMUM_CHARGE_FOR_MESSAGES,
  MINIMUM_CHARGE_FOR_MESSAGES,
} from '../../../config';
import { formatCurrencyAsString } from '../../../util/formatCurrency';
import { formatPercent } from '../../../util/textFormat';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Button from '../../ui/Button';
import Icon from '../icons/Icon';
import PaidMessageSlider from './PaidMessageSlider';

type OwnProps = {
  chargeForMessages: number;
  canChangeChargeForMessages?: boolean;
  isGroupChat?: boolean;
  onChange: (value: number) => void;
};

type StateProps = {
  starsUsdWithdrawRate: number;
  starsPaidMessageAmountMax: number;
  starsPaidMessageCommissionPermille: number;
};

function PaidMessagePrice({
  starsUsdWithdrawRate,
  starsPaidMessageAmountMax,
  starsPaidMessageCommissionPermille,
  canChangeChargeForMessages,
  isGroupChat,
  chargeForMessages,
  onChange,
}: OwnProps & StateProps) {
  const { openPremiumModal } = getActions();

  const lang = useLang();

  const handleChargeForMessagesChange = useLastCallback((value: number) => {
    onChange?.(value);
  });

  const handleUnlockWithPremium = useLastCallback(() => {
    openPremiumModal({ initialSection: 'message_privacy' });
  });

  return (
    <>
      <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>
        {lang('SectionTitleStarsForForMessages')}
      </h4>
      <PaidMessageSlider
        defaultValue={chargeForMessages}
        min={MINIMUM_CHARGE_FOR_MESSAGES}
        max={starsPaidMessageAmountMax}
        value={chargeForMessages}
        onChange={handleChargeForMessagesChange}
        canChangeChargeForMessages={canChangeChargeForMessages}
        readOnly={!canChangeChargeForMessages}
      />
      {!canChangeChargeForMessages && (
        <Button
          color="primary"
          fluid
          noForcedUpperCase
          className="settings-unlock-button"
          onClick={handleUnlockWithPremium}
        >
          <span className="settings-unlock-button-title">
            {lang('UnlockButtonTitle')}
            <Icon name="lock-badge" className="settings-unlock-button-icon" />
          </span>
        </Button>
      )}
      {canChangeChargeForMessages && (
        <p className="settings-item-description-larger" dir={lang.isRtl ? 'rtl' : undefined}>
          {lang(isGroupChat ? 'SetPriceGroupDescription' : 'SectionDescriptionStarsForForMessages', {
            percent: formatPercent(starsPaidMessageCommissionPermille * 100),
            amount: formatCurrencyAsString(
              chargeForMessages * starsUsdWithdrawRate * starsPaidMessageCommissionPermille,
              'USD',
              lang.code,
            ),
          }, {
            withNodes: true,
          })}
        </p>
      )}
    </>
  );
}

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const starsUsdWithdrawRateX1000 = global.appConfig.starsUsdWithdrawRateX1000;
    const starsUsdWithdrawRate = starsUsdWithdrawRateX1000 ? starsUsdWithdrawRateX1000 / 1000 : 1;
    const configStarsPaidMessageCommissionPermille = global.appConfig.starsPaidMessageCommissionPermille;
    const starsPaidMessageCommissionPermille = configStarsPaidMessageCommissionPermille
      ? configStarsPaidMessageCommissionPermille / 1000 : 100;

    return {
      starsPaidMessageCommissionPermille,
      starsUsdWithdrawRate,
      starsPaidMessageAmountMax: global.appConfig.starsPaidMessageAmountMax || DEFAULT_MAXIMUM_CHARGE_FOR_MESSAGES,
    };
  },
)(PaidMessagePrice));
