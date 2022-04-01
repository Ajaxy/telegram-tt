import React, { FC, memo, useCallback } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import { ApiSticker } from '../../../../api/types';
import { SettingsScreens } from '../../../../types';

import { selectAnimatedEmoji } from '../../../../global/selectors';
import useLang from '../../../../hooks/useLang';
import useHistoryBack from '../../../../hooks/useHistoryBack';

import Button from '../../../ui/Button';
import AnimatedEmoji from '../../../common/AnimatedEmoji';

type OwnProps = {
  isActive?: boolean;
  onScreenSelect: (screen: SettingsScreens) => void;
  onReset: () => void;
};

type StateProps = {
  animatedEmoji: ApiSticker;
};

const SettingsTwoFaCongratulations: FC<OwnProps & StateProps> = ({
  isActive, onReset, animatedEmoji, onScreenSelect,
}) => {
  const lang = useLang();

  const handleClick = useCallback(() => {
    onScreenSelect(SettingsScreens.Privacy);
  }, [onScreenSelect]);

  useHistoryBack(isActive, onReset, onScreenSelect, SettingsScreens.TwoFaCongratulations);

  return (
    <div className="settings-content two-fa custom-scroll">
      <div className="settings-content-header no-border">
        <AnimatedEmoji sticker={animatedEmoji} size="large" />

        <p className="settings-item-description mb-3" dir="auto">
          {lang('TwoStepVerificationPasswordSetInfo')}
        </p>
      </div>

      <div className="settings-item pt-0">
        <Button onClick={handleClick}>{lang('TwoStepVerificationPasswordReturnSettings')}</Button>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>((global) => {
  return {
    animatedEmoji: selectAnimatedEmoji(global, '🥳'),
  };
})(SettingsTwoFaCongratulations));
