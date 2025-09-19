import {
  memo, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { DEBUG_LOG_FILENAME } from '../../../config';
import { selectSharedSettings } from '../../../global/selectors/sharedState';
import {
  IS_SNAP_EFFECT_SUPPORTED,
  IS_WAVE_TRANSFORM_SUPPORTED,
} from '../../../util/browser/windowEnvironment';
import { getDebugLogs } from '../../../util/debugConsole';
import download from '../../../util/download';
import { getAccountSlotUrl } from '../../../util/multiaccount';
import { LOCAL_TGS_URLS } from '../../common/helpers/animatedAssets';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useLastCallback from '../../../hooks/useLastCallback';
import useMultiaccountInfo from '../../../hooks/useMultiaccountInfo';
import useOldLang from '../../../hooks/useOldLang';

import AnimatedIconWithPreview from '../../common/AnimatedIconWithPreview';
import { animateSnap } from '../../main/visualEffects/SnapEffectContainer';
import Checkbox from '../../ui/Checkbox';
import ListItem from '../../ui/ListItem';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = {
  shouldForceHttpTransport?: boolean;
  shouldAllowHttpTransport?: boolean;
  shouldCollectDebugLogs?: boolean;
  shouldDebugExportedSenders?: boolean;
};

const SettingsExperimental = ({
  isActive,
  shouldForceHttpTransport,
  shouldAllowHttpTransport,
  shouldCollectDebugLogs,
  shouldDebugExportedSenders,
  onReset,
}: OwnProps & StateProps) => {
  const { requestConfetti, setSharedSettingOption, requestWave } = getActions();

  const snapButtonRef = useRef<HTMLDivElement>();
  const [isSnapButtonAnimating, setIsSnapButtonAnimating] = useState(false);

  const lang = useOldLang();

  const accounts = useMultiaccountInfo();

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const handleDownloadLog = useLastCallback(() => {
    const file = new File([getDebugLogs()], DEBUG_LOG_FILENAME, { type: 'text/plain' });
    const url = URL.createObjectURL(file);
    download(url, DEBUG_LOG_FILENAME);
  });

  const handleRequestWave = useLastCallback((e: React.MouseEvent<HTMLElement, MouseEvent>) => {
    requestWave({ startX: e.clientX, startY: e.clientY });
  });

  const handleRequestConfetti = useLastCallback(() => {
    requestConfetti({ withStars: true });
  });

  const handleSnap = useLastCallback(() => {
    const button = snapButtonRef.current;
    if (!button) return;

    if (animateSnap(button)) {
      setIsSnapButtonAnimating(true);
      // Manual reset for debug
      setTimeout(() => {
        setIsSnapButtonAnimating(false);
      }, 1500);
    }
  });

  const newAccountUrl = useMemo(() => {
    if (!Object.values(accounts).length) {
      return undefined;
    }

    let freeIndex = 1;
    while (accounts[freeIndex]) {
      freeIndex += 1;
    }

    return getAccountSlotUrl(freeIndex, true, true);
  }, [accounts]);

  return (
    <div className="settings-content custom-scroll">
      <div className="settings-content-header no-border">
        <AnimatedIconWithPreview
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
          href={newAccountUrl}
          icon="add-user"
        >
          <div className="title">Login on Test Server</div>
        </ListItem>
      </div>
      <div className="settings-item">
        <ListItem
          onClick={handleRequestConfetti}
          icon="animations"
        >
          <div className="title">Launch some confetti!</div>
        </ListItem>
        <ListItem
          onClick={handleRequestWave}
          icon="story-expired"
          disabled={!IS_WAVE_TRANSFORM_SUPPORTED}
        >
          <div className="title">Start wave</div>
        </ListItem>
        <ListItem
          ref={snapButtonRef}
          onClick={handleSnap}
          icon="spoiler"
          disabled={!IS_SNAP_EFFECT_SUPPORTED}
          style={isSnapButtonAnimating ? 'visibility: hidden' : ''}
        >
          <div className="title">Vaporize this button</div>
        </ListItem>
      </div>
      <div className="settings-item">
        <Checkbox
          label="Allow HTTP Transport"
          checked={Boolean(shouldAllowHttpTransport)}

          onCheck={() => setSharedSettingOption({ shouldAllowHttpTransport: !shouldAllowHttpTransport })}
        />

        <Checkbox
          label="Force HTTP Transport"
          disabled={!shouldAllowHttpTransport}
          checked={Boolean(shouldForceHttpTransport)}

          onCheck={() => setSharedSettingOption({ shouldForceHttpTransport: !shouldForceHttpTransport })}
        />
      </div>
      <div className="settings-item">
        <Checkbox
          label={lang('DebugMenuEnableLogs')}
          checked={Boolean(shouldCollectDebugLogs)}

          onCheck={() => setSharedSettingOption({ shouldCollectDebugLogs: !shouldCollectDebugLogs })}
        />

        <Checkbox
          label="Enable exported senders debug"
          checked={Boolean(shouldDebugExportedSenders)}

          onCheck={() => setSharedSettingOption({ shouldDebugExportedSenders: !shouldDebugExportedSenders })}
        />

        <ListItem
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
  (global): Complete<StateProps> => {
    const {
      shouldForceHttpTransport,
      shouldAllowHttpTransport,
      shouldCollectDebugLogs,
      shouldDebugExportedSenders,
    } = selectSharedSettings(global);

    return {
      shouldForceHttpTransport,
      shouldAllowHttpTransport,
      shouldCollectDebugLogs,
      shouldDebugExportedSenders,
    };
  },
)(SettingsExperimental));
