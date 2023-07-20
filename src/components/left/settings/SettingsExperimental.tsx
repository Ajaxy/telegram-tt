import React, { memo } from '../../../lib/teact/teact';

import type { FC } from '../../../lib/teact/teact';

import { DEBUG_LOG_FILENAME } from '../../../config';
import { getActions, withGlobal } from '../../../global';
import { LOCAL_TGS_URLS } from '../../common/helpers/animatedAssets';
import { getDebugLogs } from '../../../util/debugConsole';
import download from '../../../util/download';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import AnimatedIcon from '../../common/AnimatedIcon';
import ListItem from '../../ui/ListItem';
import Checkbox from '../../ui/Checkbox';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = {
  shouldShowLoginCodeInChatList?: boolean;
  shouldForceHttpTransport?: boolean;
  shouldAllowHttpTransport?: boolean;
  shouldCollectDebugLogs?: boolean;
  shouldDebugExportedSenders?: boolean;
};

const SettingsExperimental: FC<OwnProps & StateProps> = ({
  isActive,
  onReset,
  shouldShowLoginCodeInChatList,
  shouldForceHttpTransport,
  shouldAllowHttpTransport,
  shouldCollectDebugLogs,
  shouldDebugExportedSenders,
}) => {
  const { requestConfetti, setSettingOption } = getActions();
  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const handleDownloadLog = useLastCallback(() => {
    const file = new File([getDebugLogs()], DEBUG_LOG_FILENAME, { type: 'text/plain' });
    const url = URL.createObjectURL(file);
    download(url, DEBUG_LOG_FILENAME);
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

        <Checkbox
          label="Allow HTTP Transport"
          checked={Boolean(shouldAllowHttpTransport)}
          // eslint-disable-next-line react/jsx-no-bind
          onCheck={() => setSettingOption({ shouldAllowHttpTransport: !shouldAllowHttpTransport })}
        />

        <Checkbox
          label="Force HTTP Transport"
          disabled={!shouldAllowHttpTransport}
          checked={Boolean(shouldForceHttpTransport)}
          // eslint-disable-next-line react/jsx-no-bind
          onCheck={() => setSettingOption({ shouldForceHttpTransport: !shouldForceHttpTransport })}
        />

        <Checkbox
          label={lang('DebugMenuEnableLogs')}
          checked={Boolean(shouldCollectDebugLogs)}
          // eslint-disable-next-line react/jsx-no-bind
          onCheck={() => setSettingOption({ shouldCollectDebugLogs: !shouldCollectDebugLogs })}
        />

        <Checkbox
          label="Enable exported senders debug"
          checked={Boolean(shouldDebugExportedSenders)}
          // eslint-disable-next-line react/jsx-no-bind
          onCheck={() => setSettingOption({ shouldDebugExportedSenders: !shouldDebugExportedSenders })}
        />

        <ListItem
          // eslint-disable-next-line react/jsx-no-bind
          onClick={handleDownloadLog}
          icon="bug"
        >
          <div className="title">Download log</div>
        </ListItem>
      </div>
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    return {
      shouldShowLoginCodeInChatList: global.settings.byKey.shouldShowLoginCodeInChatList,
      shouldForceHttpTransport: global.settings.byKey.shouldForceHttpTransport,
      shouldAllowHttpTransport: global.settings.byKey.shouldAllowHttpTransport,
      shouldCollectDebugLogs: global.settings.byKey.shouldCollectDebugLogs,
      shouldDebugExportedSenders: global.settings.byKey.shouldDebugExportedSenders,
    };
  },
)(SettingsExperimental));
