import React, { FC, memo } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../lib/teact/teactn';

import { ApiSticker } from '../../../../api/types';

import { selectAnimatedEmoji } from '../../../../modules/selectors';
import useLang from '../../../../hooks/useLang';

import Button from '../../../ui/Button';
import AnimatedEmoji from '../../../common/AnimatedEmoji';

type OwnProps = {
  onStart: NoneToVoidFunction;
};

type StateProps = {
  animatedEmoji: ApiSticker;
};

const SettingsTwoFaStart: FC<OwnProps & StateProps> = ({ animatedEmoji, onStart }) => {
  const lang = useLang();

  return (
    <div className="settings-content two-fa custom-scroll">
      <div className="settings-content-header">
        <AnimatedEmoji sticker={animatedEmoji} />

        <p className="settings-item-description mb-3" dir="auto">
          {lang('SetAdditionalPasswordInfo')}
        </p>
      </div>

      <div className="settings-item pt-0 no-border">
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
