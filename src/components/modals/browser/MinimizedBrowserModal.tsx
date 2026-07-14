import {
  memo, useMemo,
  useRef,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiUser, ApiWebPageFull } from '../../../api/types';
import type { BrowserState } from '../../../types/browser';

import { selectTabBrowserState } from '../../../global/helpers/browser';
import { selectFullWebPage, selectTabState, selectUser } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { unique } from '../../../util/iteratees';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import AvatarList from '../../common/AvatarList';
import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';

import styles from './MinimizedBrowserModal.module.scss';

type StateProps = {
  activeTabBot?: ApiUser;
  activeWebPage?: ApiWebPageFull;
  browser: BrowserState;
  isMinimizedState?: boolean;
};

const MinimizedBrowserModal = ({
  activeTabBot, activeWebPage, browser, isMinimizedState,
}: StateProps) => {
  const {
    changeBrowserModalState,
    closeBrowserModal,
  } = getActions();

  const oldLang = useOldLang();
  const lang = useLang();
  const ref = useRef<HTMLDivElement>();

  const openedTabsValues = useMemo(() => {
    return Object.values(browser.openedTabs);
  }, [browser.openedTabs]);

  const openedTabsCount = openedTabsValues.length;

  const peers = useMemo(() => {
    if (!openedTabsCount) return [];

    const global = getGlobal();
    const activeTabBotId = activeTabBot?.id;
    const openedApps = unique([
      activeTabBotId,
      ...openedTabsValues.map((tab) => (tab.type === 'webApp' ? tab.webApp.botId : undefined)),
    ]);
    const bots = openedApps.map((id) => id && selectUser(global, id)).filter(Boolean).slice(0, 3);
    return bots;
  }, [openedTabsCount, activeTabBot, openedTabsValues]);

  const handleCloseClick = useLastCallback(() => {
    closeBrowserModal();
  });

  const handleExpandClick = useLastCallback(() => {
    changeBrowserModalState({ state: 'maximized' });
  });

  if (!isMinimizedState) return undefined;

  function renderTitle() {
    const activePeerName = activeTabBot?.firstName;
    const activeTabName = activePeerName || getWebPageTitle(activeWebPage) || lang('InstantView');
    const title = openedTabsCount && activeTabName && openedTabsCount > 1
      ? lang('BrowserMoreTabs',
        {
          title: activeTabName,
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
        iconName="close"
        iconClassName={styles.icon}
        ariaLabel={oldLang('Close')}
        onClick={handleCloseClick}
      />
      {peers.length ? (
        <AvatarList className={styles.avatars} size="mini" peers={peers} />
      ) : (
        <div className={styles.browserIcon}>
          <Icon name="boost" />
        </div>
      )}
      {renderTitle()}
      <Button
        className={buildClassName(
          styles.windowStateButton,
          'no-drag',
        )}
        round
        color="translucent"
        size="tiny"
        iconName="expand-modal"
        iconClassName={styles.stateIcon}
        onClick={handleExpandClick}
      />
    </div>
  );
};

export default memo(withGlobal(
  (global): Complete<StateProps> => {
    const tabState = selectTabState(global);
    const browser = selectTabBrowserState(tabState);
    const activeTab = browser.activeTabKey ? browser.openedTabs[browser.activeTabKey] : undefined;

    const botId = activeTab?.type === 'webApp' ? activeTab.webApp.botId : undefined;
    const activeWebPage = activeTab?.type === 'instantView'
      ? selectFullWebPage(global, activeTab.webPageId) : undefined;
    const isMinimizedState = browser.modalState === 'minimized';
    const activeTabBot = botId ? selectUser(global, botId) : undefined;

    return {
      activeTabBot,
      activeWebPage,
      browser,
      isMinimizedState,
    };
  },
)(MinimizedBrowserModal));

function getWebPageTitle(webPage?: ApiWebPageFull) {
  return webPage?.title || webPage?.siteName || webPage?.displayUrl;
}
