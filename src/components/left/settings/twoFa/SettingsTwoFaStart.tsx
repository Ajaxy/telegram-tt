import type { FC } from '../../../../lib/teact/teact';
import React, { memo } from '../../../../lib/teact/teact';

import useLang from '../../../../hooks/useLang';
import useHistoryBack from '../../../../hooks/useHistoryBack';

import Button from '../../../ui/Button';
import AnimatedIconWithPreview from '../../../common/AnimatedIconWithPreview';

import lockPreviewUrl from '../../../../assets/lock.png';
import { LOCAL_TGS_URLS } from '../../../common/helpers/animatedAssets';

type OwnProps = {
  onStart: NoneToVoidFunction;
  isActive?: boolean;
  onReset: () => void;
};

const SettingsTwoFaStart: FC<OwnProps> = ({
  isActive, onReset, onStart,
}) => {
  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  return (
    <div className="settings-content two-fa custom-scroll">
      <div className="settings-content-header no-border">
        <AnimatedIconWithPreview
          tgsUrl={LOCAL_TGS_URLS.Lock}
          previewUrl={lockPreviewUrl}
          size={160}
          className="settings-content-icon"
        />

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

export default memo(SettingsTwoFaStart);
