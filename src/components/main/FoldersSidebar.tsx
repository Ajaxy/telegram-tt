import { memo, useEffect, useMemo, useRef } from '@teact';
import { getActions, withGlobal } from '../../global';

import type { ApiChatFolder, ApiChatlistExportedInvite } from '../../api/types';
import { LeftColumnContent, SettingsScreens } from '../../types';

import { selectTabState } from '../../global/selectors';
import { selectCurrentLimit } from '../../global/selectors/limits';
import { IS_TAURI } from '../../util/browser/globalEnvironment';
import { IS_MAC_OS } from '../../util/browser/windowEnvironment';
import buildClassName from '../../util/buildClassName';

import useFolderTabs from '../../hooks/useFolderTabs';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useScrolledState from '../../hooks/useScrolledState';

import MainMenuDropdown from '../common/MainMenuDropdown';
import Button from '../ui/Button';
import Folder from '../ui/Folder';

import styles from './FoldersSidebar.module.scss';

type StateProps = {
  chatFoldersById: Record<number, ApiChatFolder>;
  folderInvitesById: Record<number, ApiChatlistExportedInvite[]>;
  orderedFolderIds?: number[];
  activeChatFolder: number;
  maxFolders: number;
  maxChatLists: number;
  maxFolderInvites: number;
};

type OwnProps = {
  isActive: boolean;
};

const FIRST_FOLDER_INDEX = 0;

const FoldersSidebar = ({
  chatFoldersById,
  orderedFolderIds,
  activeChatFolder,
  maxFolders,
  maxChatLists,
  folderInvitesById,
  maxFolderInvites,
  isActive,
}: OwnProps & StateProps) => {
  const {
    loadChatFolders,
    setActiveChatFolder,
    openLeftColumnContent,
    openSettingsScreen,
  } = getActions();

  const tabsRef = useRef<HTMLDivElement>();

  useEffect(() => {
    loadChatFolders();
  }, []);

  const scrollChatListToTop = useLastCallback(() => {
    const activeList = document.querySelector<HTMLElement>('#LeftColumn .chat-list.Transition_slide-active');
    activeList?.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  });

  const { folderTabs } = useFolderTabs({
    sidebarMode: true,
    orderedFolderIds,
    chatFoldersById,
    maxFolders,
    maxChatLists,
    folderInvitesById,
    maxFolderInvites,
  });

  const {
    handleScroll,
    isAtBeginning,
    isAtEnd,
  } = useScrolledState();

  const lang = useLang();

  const handleSwitchTab = useLastCallback((index: number) => {
    openLeftColumnContent({ contentKey: LeftColumnContent.ChatList });
    openSettingsScreen({ screen: undefined });
    setActiveChatFolder({ activeChatFolder: index }, { forceOnHeavyAnimation: true });
    if (activeChatFolder === index) {
      scrollChatListToTop();
    }

    tabsRef.current?.children[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  const handleSettingsClick = useLastCallback(() => {
    openLeftColumnContent({ contentKey: LeftColumnContent.Settings });
    openSettingsScreen({ screen: SettingsScreens.Folders });
  });

  // Prevent `activeTab` pointing at non-existing folder after update
  useEffect(() => {
    if (!folderTabs?.length) {
      return;
    }

    if (activeChatFolder >= folderTabs.length) {
      setActiveChatFolder({ activeChatFolder: FIRST_FOLDER_INDEX });
    }
  }, [activeChatFolder, folderTabs, setActiveChatFolder]);

  const MainButton = useMemo(() => {
    return ({ onTrigger, isOpen }: { onTrigger: () => void; isOpen?: boolean }) => (
      <Button
        color="translucent"
        className={buildClassName(isOpen ? 'active' : '', styles.menuButton)}
        onClick={onTrigger}
        ariaLabel={lang('AriaLabelOpenMenu')}
        iconName="menu"
        iconClassName={styles.icon}
      />
    );
  }, [lang]);

  if (!isActive) {
    return undefined;
  }

  return (
    <div
      className={styles.root}
      id="FoldersSidebar"
    >
      <MainMenuDropdown
        trigger={MainButton}
        className={buildClassName(IS_TAURI && IS_MAC_OS && styles.hideMenuButton)}
      />
      {!isAtBeginning && <div className={styles.divider} />}
      <div
        ref={tabsRef}
        className={buildClassName(styles.tabs, 'custom-scroll', 'no-scrollbar')}
        onScroll={handleScroll}
      >
        {folderTabs?.map((tab, i) => (
          <Folder
            key={tab.id}
            title={tab.title}
            isActive={i === activeChatFolder}
            isBlocked={tab.isBlocked}
            badgeCount={tab.badgeCount}
            isBadgeActive={tab.isBadgeActive}
            onClick={handleSwitchTab}
            clickArg={i}
            contextActions={tab.contextActions}
            contextRootElementSelector="#FoldersSidebar"
            icon={tab.emoticon}
            className={styles.tab}
          />
        ))}
      </div>
      {!isAtEnd && <div className={styles.divider} />}
      <Button
        color="translucent"
        className={buildClassName(styles.menuButton, styles.settingsButton)}
        onClick={handleSettingsClick}
        iconName="tools"
        iconClassName={styles.icon}
      />
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    const {
      chatFolders: {
        byId: chatFoldersById,
        orderedIds: orderedFolderIds,
        invites: folderInvitesById,
      },
    } = global;
    const { activeChatFolder } = selectTabState(global);

    return {
      chatFoldersById,
      folderInvitesById,
      orderedFolderIds,
      activeChatFolder,
      maxFolders: selectCurrentLimit(global, 'dialogFilters'),
      maxFolderInvites: selectCurrentLimit(global, 'chatlistInvites'),
      maxChatLists: selectCurrentLimit(global, 'chatlistJoined'),
    };
  },
)(FoldersSidebar));
