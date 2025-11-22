import type { TeactNode } from '../../lib/teact/teact';
import { useRef } from '../../lib/teact/teact';

import type { ApiMessageEntityCustomEmoji } from '../../api/types';
import type { MenuItemContextAction } from './ListItem';

import { MouseButton } from '../../util/browser/windowEnvironment';
import buildClassName from '../../util/buildClassName';

import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import { useFastClick } from '../../hooks/useFastClick';
import useFlag from '../../hooks/useFlag';
import useLastCallback from '../../hooks/useLastCallback';

import FolderIcon from '../common/FolderIcon';
import Icon from '../common/icons/Icon';
import Menu from './Menu';
import MenuItem from './MenuItem';
import MenuSeparator from './MenuSeparator';

import styles from './Folder.module.scss';

type OwnProps = {
  className?: string;
  title: TeactNode;
  isActive?: boolean;
  isBlocked?: boolean;
  badgeCount?: number;
  isBadgeActive?: boolean;
  contextActions?: MenuItemContextAction[];
  contextRootElementSelector?: string;
  icon?: string | ApiMessageEntityCustomEmoji;
  clickArg?: number;
  onClick?: (arg: number) => void;
};

const Folder = ({
  className,
  title,
  isActive,
  isBlocked,
  badgeCount,
  isBadgeActive,
  contextActions,
  contextRootElementSelector,
  icon,
  clickArg,
  onClick,
}: OwnProps) => {
  const folderRef = useRef<HTMLDivElement>();
  const [isHovering, markHovering, unmarkHovering] = useFlag();

  const {
    contextMenuAnchor, handleContextMenu, handleBeforeContextMenu, handleContextMenuClose,
    handleContextMenuHide, isContextMenuOpen,
  } = useContextMenuHandlers(folderRef, !contextActions);

  const { handleClick, handleMouseDown } = useFastClick((e: React.MouseEvent<HTMLDivElement>) => {
    if (contextActions && (e.button === MouseButton.Secondary || !onClick)) {
      handleBeforeContextMenu(e);
    }

    if (e.type === 'mousedown' && e.button !== MouseButton.Main) {
      return;
    }

    onClick?.(clickArg!);
  });

  const getTriggerElement = useLastCallback(() => folderRef.current);
  const getRootElement = useLastCallback(
    () => (contextRootElementSelector ? folderRef.current!.closest(contextRootElementSelector) : document.body),
  );
  const getMenuElement = useLastCallback(
    () => document.querySelector(`.${styles.contextMenu} .bubble`),
  );
  const getLayout = useLastCallback(() => ({ withPortal: true }));

  return (
    <div
      className={buildClassName(styles.folder, isActive && styles.active, className)}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      onMouseEnter={markHovering}
      onMouseLeave={unmarkHovering}
      ref={folderRef}
    >
      <div className={styles.icon}>
        <FolderIcon
          emoji={typeof icon === 'string' ? icon : undefined}
          customEmojiId={typeof icon === 'object' ? icon.documentId : undefined}
          shouldAnimate={isHovering}
        />
        {Boolean(badgeCount) && (
          <span className={buildClassName(styles.badge, isBadgeActive && styles.badgeActive)}>{badgeCount}</span>
        )}
      </div>
      <span className={styles.inner}>
        <div className={styles.title}>
          {isBlocked && <Icon name="lock-badge" className={styles.blocked} />}
          {title}
        </div>
      </span>

      {contextActions && contextMenuAnchor !== undefined && (
        <Menu
          isOpen={isContextMenuOpen}
          anchor={contextMenuAnchor}
          getTriggerElement={getTriggerElement}
          getRootElement={getRootElement}
          getMenuElement={getMenuElement}
          getLayout={getLayout}
          className={styles.contextMenu}
          autoClose
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
          withPortal
        >
          {contextActions.map((action) => (
            ('isSeparator' in action) ? (
              <MenuSeparator key={action.key || 'separator'} />
            ) : (
              <MenuItem
                key={action.title}
                icon={action.icon}
                destructive={action.destructive}
                disabled={!action.handler}
                onClick={action.handler}
              >
                {action.title}
              </MenuItem>
            )
          ))}
        </Menu>
      )}
    </div>
  );
};

export default Folder;
