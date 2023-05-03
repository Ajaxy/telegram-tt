import React, { memo } from '../../../lib/teact/teact';

import type { FC } from '../../../lib/teact/teact';

import { getActions, withGlobal } from '../../../global';
import { LOCAL_TGS_URLS } from '../../common/helpers/animatedAssets';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';

import AnimatedIcon from '../../common/AnimatedIcon';
import ListItem from '../../ui/ListItem';
import Checkbox from '../../ui/Checkbox';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = {
  shouldShowLoginCodeInChatList?: boolean;
};

const SettingsExperimental: FC<OwnProps & StateProps> = ({
  isActive,
  onReset,
  shouldShowLoginCodeInChatList,
}) => {
  const { requestConfetti, setSettingOption } = getActions();
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
        <p className="settings-item-description pt-3" dir="auto">{lang('lng_settings_experimental_about')}</p>
      </div>
      <div className="settings-item">
        <ListItem
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => requestConfetti()}
          icon="animations"
        >
          <div className="title">Launch some confetti!</div>
        </ListItem>

        <Checkbox
          label="Show login code in chat list"
          checked={Boolean(shouldShowLoginCodeInChatList)}
          // eslint-disable-next-line react/jsx-no-bind
          onCheck={() => setSettingOption({ shouldShowLoginCodeInChatList: !shouldShowLoginCodeInChatList })}
        />
      </div>
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    return {
      shouldShowLoginCodeInChatList: global.settings.byKey.shouldShowLoginCodeInChatList,
    };
  },
)(SettingsExperimental));
