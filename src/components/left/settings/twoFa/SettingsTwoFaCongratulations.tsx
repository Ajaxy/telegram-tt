import type { FC } from '../../../../lib/teact/teact';
import React, { memo, useCallback } from '../../../../lib/teact/teact';

import { SettingsScreens } from '../../../../types';

import { STICKER_SIZE_TWO_FA } from '../../../../config';
import { LOCAL_TGS_URLS } from '../../../common/helpers/animatedAssets';

import useHistoryBack from '../../../../hooks/useHistoryBack';
import useOldLang from '../../../../hooks/useOldLang';

import AnimatedIcon from '../../../common/AnimatedIcon';
import Button from '../../../ui/Button';

type OwnProps = {
  isActive?: boolean;
  onScreenSelect: (screen: SettingsScreens) => void;
  onReset: () => void;
};

const SettingsTwoFaCongratulations: FC<OwnProps> = ({
  isActive, onReset, onScreenSelect,
}) => {
  const lang = useOldLang();

  const handleClick = useCallback(() => {
    onScreenSelect(SettingsScreens.Privacy);
  }, [onScreenSelect]);

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  return (
    <div className="settings-content two-fa custom-scroll">
      <div className="settings-content-header no-border">
        <AnimatedIcon
          size={STICKER_SIZE_TWO_FA}
          tgsUrl={LOCAL_TGS_URLS.Congratulations}
          className="settings-content-icon"
        />

        <p className="settings-item-description mb-3" dir="auto">
          {lang('TwoStepVerificationPasswordSetInfo')}
        </p>
      </div>

      <div className="settings-item pt-2">
        <Button onClick={handleClick}>{lang('TwoStepVerificationPasswordReturnSettings')}</Button>
      </div>
    </div>
  );
};

export default memo(SettingsTwoFaCongratulations);
