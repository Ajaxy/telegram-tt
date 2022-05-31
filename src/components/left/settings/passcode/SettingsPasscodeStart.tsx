import type { FC } from '../../../../lib/teact/teact';
import React, { memo } from '../../../../lib/teact/teact';

import { STICKER_SIZE_PASSCODE } from '../../../../config';
import { LOCAL_TGS_URLS } from '../../../common/helpers/animatedAssets';
import useLang from '../../../../hooks/useLang';
import useHistoryBack from '../../../../hooks/useHistoryBack';

import Button from '../../../ui/Button';
import AnimatedIconWithPreview from '../../../common/AnimatedIconWithPreview';

import lockPreviewUrl from '../../../../assets/lock.png';

type OwnProps = {
  onStart: NoneToVoidFunction;
  isActive?: boolean;
  onReset: () => void;
};

const SettingsPasscodeStart: FC<OwnProps> = ({
  isActive, onReset, onStart,
}) => {
  const lang = useLang();

  useHistoryBack({ isActive, onBack: onReset });

  return (
    <div className="settings-content local-passcode custom-scroll">
      <div className="settings-content-header no-border">
        <AnimatedIconWithPreview
          tgsUrl={LOCAL_TGS_URLS.Lock}
          previewUrl={lockPreviewUrl}
          size={STICKER_SIZE_PASSCODE}
          className="settings-content-icon"
        />

        <p className="settings-item-description" dir="auto">
          When you set up an additional passcode, a lock icon will appear on the chats page.
          Tap it to lock and unlock your Telegram WebZ.
        </p>
        <p className="settings-item-description mb-3" dir="auto">
          Note: if you forget your local passcode, you&apos;ll need to log out of Telegram WebZ and log in again.
        </p>
      </div>

      <div className="settings-item pt-0">
        <Button onClick={onStart}>{lang('EnablePasscode')}</Button>
      </div>
    </div>
  );
};

export default memo(SettingsPasscodeStart);
