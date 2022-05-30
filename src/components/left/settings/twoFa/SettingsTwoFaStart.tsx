import type { FC } from '../../../../lib/teact/teact';
import React, { memo } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import type { ApiSticker } from '../../../../api/types';

import { selectAnimatedEmoji } from '../../../../global/selectors';
import useLang from '../../../../hooks/useLang';
import useHistoryBack from '../../../../hooks/useHistoryBack';

import Button from '../../../ui/Button';
import AnimatedEmoji from '../../../common/AnimatedEmoji';

type OwnProps = {
  onStart: NoneToVoidFunction;
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = {
  animatedEmoji: ApiSticker;
};

const SettingsTwoFaStart: FC<OwnProps & StateProps> = ({
  isActive, onReset, animatedEmoji, onStart,
}) => {
  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  return (
    <div className="settings-content two-fa custom-scroll">
      <div className="settings-content-header no-border">
        <AnimatedEmoji sticker={animatedEmoji} size="large" />

        <p className="settings-item-description mb-3" dir="auto">
          {lang('SetAdditionalPasswordInfo')}
        </p>
      </div>

      <div className="settings-item pt-0">
        <Button onClick={onStart}>{lang('EditAdminTransferSetPassword')}</Button>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>((global) => {
  return {
    animatedEmoji: selectAnimatedEmoji(global, '🔐'),
  };
})(SettingsTwoFaStart));
