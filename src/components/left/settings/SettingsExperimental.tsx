import React, { memo } from '../../../lib/teact/teact';

import type { FC } from '../../../lib/teact/teact';

import { getActions } from '../../../global';
import { LOCAL_TGS_URLS } from '../../common/helpers/animatedAssets';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';

import AnimatedIcon from '../../common/AnimatedIcon';
import ListItem from '../../ui/ListItem';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

const SettingsExperimental: FC<OwnProps> = ({
  isActive,
  onReset,
}) => {
  const { requestConfetti } = getActions();
  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  return (
    <div className="settings-content custom-scroll">
      <div className="settings-content-header no-border">
        <AnimatedIcon
          tgsUrl={LOCAL_TGS_URLS.Experimental}
          size={200}
          className="experimental-duck"
          nonInteractive
          noLoop={false}
        />
        <p className="settings-item-description" dir="auto">{lang('lng_settings_experimental_about')}</p>
      </div>
      <div className="settings-item">
        <ListItem
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => requestConfetti()}
          icon="animations"
        >
          <div className="title">Launch some confetti!</div>
        </ListItem>
      </div>
    </div>
  );
};

export default memo(SettingsExperimental);
