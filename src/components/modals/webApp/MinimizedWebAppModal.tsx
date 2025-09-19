import {
  memo, useMemo,
  useRef,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiUser } from '../../../api/types';
import type { WebApp } from '../../../types/webapp';

import { selectActiveWebApp, selectTabState, selectUser } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { unique } from '../../../util/iteratees';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import AvatarList from '../../common/AvatarList';
import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';

import styles from './MinimizedWebAppModal.module.scss';

type StateProps = {
  activeTabBot?: ApiUser;
  isMinimizedState?: boolean;
  openedWebApps?: Record<string, WebApp>;
};

const MinimizedWebAppModal = ({
  activeTabBot, isMinimizedState, openedWebApps,
}: StateProps) => {
  const {
    changeWebAppModalState,
    closeWebAppModal,
  } = getActions();

  const oldLang = useOldLang();
  const lang = useLang();
  const ref = useRef<HTMLDivElement>();

  const openedWebAppsValues = useMemo(() => {
    return openedWebApps && Object.values(openedWebApps);
  }, [openedWebApps]);

  const openedTabsCount = openedWebAppsValues?.length;

  const peers = useMemo(() => {
    if (!openedTabsCount) return [];

    const global = getGlobal();
    const activeTabBotId = activeTabBot?.id;
    const openedApps = unique([activeTabBotId, ...openedWebAppsValues.map((app) => app.botId)]);
    const bots = openedApps.map((id) => id && selectUser(global, id)).filter(Boolean).slice(0, 3);
    return bots;
  }, [openedTabsCount, activeTabBot, openedWebAppsValues]);

  const handleCloseClick = useLastCallback(() => {
    closeWebAppModal();
  });

  const handleExpandClick = useLastCallback(() => {
    changeWebAppModalState({ state: 'maximized' });
  });

  if (!isMinimizedState) return undefined;

  function renderTitle() {
    const activeTabName = peers.length > 0 && peers[0]?.firstName;
    const title = openedTabsCount && activeTabName && openedTabsCount > 1
      ? lang('MiniAppsMoreTabs',
        {
          botName: activeTabName,
          count: openedTabsCount - 1,
        },
        {
          pluralValue: openedTabsCount - 1,
        })
      : activeTabName;

    return (
      <div className={styles.title}>
        {title}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={buildClassName(
        styles.root,
      )}
    >
      <Button
        className={styles.button}
        round
        color="translucent"
        size="tiny"
        ariaLabel={oldLang('Close')}
        onClick={handleCloseClick}
      >
        <Icon className={styles.icon} name="close" />
      </Button>
      <AvatarList className={styles.avatars} size="mini" peers={peers} />
      {renderTitle()}
      <Button
        className={buildClassName(
          styles.windowStateButton,
          'no-drag',
        )}
        round
        color="translucent"
        size="tiny"
        onClick={handleExpandClick}
      >
        <Icon className={styles.stateIcon} name="expand-modal" />
      </Button>
    </div>
  );
};

export default memo(withGlobal(
  (global): Complete<StateProps> => {
    const tabState = selectTabState(global);
    const webApps = tabState.webApps;

    const { botId } = selectActiveWebApp(global) || {};
    const { modalState, openedWebApps } = webApps || {};
    const isMinimizedState = modalState === 'minimized';
    const activeTabBot = botId ? selectUser(global, botId) : undefined;

    return {
      activeTabBot,
      isMinimizedState,
      openedWebApps,
    };
  },
)(MinimizedWebAppModal));
