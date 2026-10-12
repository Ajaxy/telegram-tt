import { type FC, memo, useRef } from '@teact';
import { APP_REVISION } from 'virtual:git-info';
import { getActions, getGlobal } from '../../global';

import type { TabState } from '../../global/types';
import { LeftColumnContent, SettingsScreens } from '../../types';

import {
  APP_NAME,
  DEBUG,
  IS_BETA,
} from '../../config';
import { selectTabState } from '../../global/selectors';
import { IS_VIEW_TRANSITION_SUPPORTED } from '../../util/browser/windowEnvironment';
import buildClassName from '../../util/buildClassName';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useLeftHeaderButtonRtlForumTransition from '../left/main/hooks/useLeftHeaderButtonRtlForumTransition';

import LeftSideMenuItems from '../left/main/LeftSideMenuItems';
import DropdownMenu from '../ui/DropdownMenu';

type OwnProps = {
  trigger?: FC<{ onTrigger: () => void; isOpen?: boolean }>;
  shouldHideSearch?: boolean;
  className?: string;
};

const LeftSideMenuDropdown = ({
  trigger,
  shouldHideSearch,
  className,
}: OwnProps) => {
  const {
    openLeftColumnContent, closeForumPanel, closeCommunityPanel, openSettingsScreen, setIsUiReady,
  } = getActions();
  const pendingAccountSwitchRef = useRef<VoidFunction>();
  const isSwitchingAccountRef = useRef(false);
  const [isBotMenuOpen, markBotMenuOpen, unmarkBotMenuOpen] = useFlag();
  const [isSwitchingAccount, markSwitchingAccount, unmarkSwitchingAccount] = useFlag();
  const lang = useLang();

  const versionString = IS_BETA ? `${APP_VERSION} Beta (${APP_REVISION})` : (DEBUG ? APP_REVISION : APP_VERSION);

  // Disable dropdown menu RTL animation for resize
  const {
    shouldDisableDropdownMenuTransitionRef,
    handleDropdownMenuTransitionEnd,
  } = useLeftHeaderButtonRtlForumTransition(shouldHideSearch);

  const handleSelectSettings = useLastCallback(() => {
    openSettingsScreen({ screen: SettingsScreens.Main });
  });

  const handleSelectContacts = useLastCallback(() => {
    openLeftColumnContent({ contentKey: LeftColumnContent.Contacts });
  });

  const handleSelectArchived = useLastCallback(() => {
    openLeftColumnContent({ contentKey: LeftColumnContent.Archived });
    closeForumPanel();
    closeCommunityPanel();
  });

  const handleSwitchAccount = useLastCallback((url: string) => {
    if (isSwitchingAccountRef.current) return;

    // Only mask the UI when canceled navigation can restore it
    if (!window.navigation) {
      window.location.replace(url);
      return;
    }

    const { uiReadyState } = selectTabState(getGlobal());
    // Lock before rendering so rapid selections cannot capture the masked UI state
    isSwitchingAccountRef.current = true;
    setIsUiReady({ uiReadyState: 0 });
    if (IS_VIEW_TRANSITION_SUPPORTED && 'onpagereveal' in window) {
      // The view transition captures the open menu and owns its closing animation
      markSwitchingAccount();
      navigateToAccount(url, uiReadyState);
    } else {
      pendingAccountSwitchRef.current = () => navigateToAccount(url, uiReadyState);
    }
  });

  const handleMenuHide = useLastCallback(() => {
    const pendingAccountSwitch = pendingAccountSwitchRef.current;
    if (!pendingAccountSwitch) return;

    pendingAccountSwitchRef.current = undefined;
    pendingAccountSwitch();
  });

  function navigateToAccount(url: string, uiReadyState: TabState['uiReadyState']) {
    window.addEventListener('pageshow', handlePageShow);

    try {
      // Account navigation replaces the menu's temporary history entry
      const { committed, finished } = window.navigation.navigate(url, { history: 'replace' });
      // Cross-document navigation settles in this document only when canceled
      Promise.all([committed, finished]).catch(restoreUi);
    } catch {
      restoreUi();
    }

    function handlePageShow(e: PageTransitionEvent) {
      if (!e.persisted) return;

      // Cross-document navigation promises remain pending when this page returns from BFCache
      restoreUi();
    }

    function restoreUi() {
      window.removeEventListener('pageshow', handlePageShow);
      setIsUiReady({ uiReadyState });
      isSwitchingAccountRef.current = false;
      unmarkSwitchingAccount();
    }
  }

  return (
    <DropdownMenu
      trigger={trigger}
      className={buildClassName(
        'main-menu',
        lang.isRtl && 'rtl',
        shouldHideSearch && lang.isRtl && 'right-aligned',
        shouldDisableDropdownMenuTransitionRef.current && lang.isRtl && 'disable-transition',
        className,
      )}
      forceOpen={isBotMenuOpen || isSwitchingAccount}
      positionX={shouldHideSearch && lang.isRtl ? 'right' : 'left'}
      transformOriginX={90}
      transformOriginY={100}
      withPortal
      onHide={handleMenuHide}
      onTransitionEnd={lang.isRtl ? handleDropdownMenuTransitionEnd : undefined}
    >
      <LeftSideMenuItems
        onSelectArchived={handleSelectArchived}
        onSelectContacts={handleSelectContacts}
        onSelectSettings={handleSelectSettings}
        onBotMenuOpened={markBotMenuOpen}
        onBotMenuClosed={unmarkBotMenuOpen}
        onSwitchAccount={handleSwitchAccount}
        footer={`${APP_NAME} ${versionString}`}
      />
    </DropdownMenu>
  );
};

export default memo(LeftSideMenuDropdown);
