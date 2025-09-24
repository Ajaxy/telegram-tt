import type { FC } from '@teact';
import { memo, useMemo } from '@teact';
import { getActions } from '../../global';

import { SettingsScreens } from '../../types';

import buildClassName from '../../util/buildClassName';

import useFoldersReducer from '../../hooks/reducers/useFoldersReducer';
import useLastCallback from '../../hooks/useLastCallback';

import Button from '../ui/Button';
import ChatFolders from './main/ChatFolders';
import LeftSideMenuDropdown from './main/LeftSideMenuDropdown';

import styles from './FoldersSidebar.module.scss';

const FoldersSidebar = () => {
  const { openSettingsScreen } = getActions();
  const MainButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger }) => (
      <Button
        ripple={true}
        color="translucent"
        isRectangular
        className={buildClassName(styles.menuButton)}
        onClick={onTrigger}
      >
        <div className={buildClassName(
          'icon', 'icon-sort', styles.menuButton,
        )}
        />
      </Button>
    );
  }, []);

  const [, foldersDispatch] = useFoldersReducer();

  const handleSelectChatList = useLastCallback(() => {
    openSettingsScreen({ screen: SettingsScreens.Folders });
  });

  return (
    <div className={buildClassName(styles.leftFolderTabs)}>
      <div>
        <LeftSideMenuDropdown trigger={MainButton} shouldHideSearch />
      </div>
      <div className={buildClassName(styles.verticalTabs)}>
        <ChatFolders
          shouldHideFolderTabs={false}
          foldersDispatch={foldersDispatch}
          isForumPanelOpen={false}
          isSidebar
        />
      </div>
      <div>
        <Button
          ripple={true}
          color="translucent"
          isRectangular
          className={buildClassName(styles.menuButton)}
          onClick={handleSelectChatList}
        >
          <div className={buildClassName(
            'icon', 'icon-settings', styles.menuButton,
          )}
          />
        </Button>
      </div>
    </div>
  );
};

export default memo(FoldersSidebar);
