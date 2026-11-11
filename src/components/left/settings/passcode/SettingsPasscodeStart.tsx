import type { FC } from '../../../../lib/teact/teact';
import { memo } from '../../../../lib/teact/teact';

import { STICKER_SIZE_PASSCODE } from '../../../../config';
import { LOCAL_TGS_PREVIEW_URLS, LOCAL_TGS_URLS } from '../../../common/helpers/animatedAssets';

import useHistoryBack from '../../../../hooks/useHistoryBack';
import useLang from '../../../../hooks/useLang';

import AnimatedIconWithPreview from '../../../common/AnimatedIconWithPreview';
import Island, { IslandDescription } from '../../../gili/layout/Island';
import Button from '../../../ui/Button';

type OwnProps = {
  isActive?: boolean;
  onStart: NoneToVoidFunction;
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
          previewUrl={LOCAL_TGS_PREVIEW_URLS.Lock}
          size={STICKER_SIZE_PASSCODE}
          className="settings-content-icon"
        />
      </div>

      <Island>
        <Button onClick={onStart}>{lang('EnablePasscode')}</Button>
      </Island>
      <IslandDescription dir="auto">
        {lang('SettingsPasscodeStart1', undefined, { withNodes: true, renderTextFilters: ['br'] })}
      </IslandDescription>
      <IslandDescription dir="auto">
        {lang('SettingsPasscodeStart2', undefined, { withNodes: true, renderTextFilters: ['br'] })}
      </IslandDescription>
    </div>
  );
};

export default memo(SettingsPasscodeStart);
