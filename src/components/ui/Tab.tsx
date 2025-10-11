import type { TeactNode } from '../../lib/teact/teact';
import { useEffect, useLayoutEffect, useRef } from '../../lib/teact/teact';

import type { MenuItemContextAction } from './ListItem';

import { requestForcedReflow, requestMutation } from '../../lib/fasterdom/fasterdom';
import { MouseButton } from '../../util/browser/windowEnvironment';
import buildClassName from '../../util/buildClassName';
import forceReflow from '../../util/forceReflow';
import renderText from '../common/helpers/renderText';

import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import { useFastClick } from '../../hooks/useFastClick';
import useLastCallback from '../../hooks/useLastCallback';

import Icon from '../common/icons/Icon';
import Menu from './Menu';
import MenuItem from './MenuItem';
import MenuSeparator from './MenuSeparator';

import './Tab.scss';

type OwnProps = {
  className?: string;
  title: TeactNode;
  isActive?: boolean;
  isBlocked?: boolean;
  badgeCount?: number;
  isBadgeActive?: boolean;
  previousActiveTab?: number;
  onClick?: (arg: number) => void;
  clickArg?: number;
  contextActions?: MenuItemContextAction[];
  contextRootElementSelector?: string;
};

const classNames = {
  active: 'Tab--active',
  badgeActive: 'Tab__badge--active',
};

const Tab = ({
  className,
  title,
  isActive,
  isBlocked,
  badgeCount,
  isBadgeActive,
  previousActiveTab,
  contextActions,
  contextRootElementSelector,
  clickArg,
  onClick,
}: OwnProps) => {
  const tabRef = useRef<HTMLDivElement>();

  useLayoutEffect(() => {
    // Set initial active state
    if (isActive && previousActiveTab === undefined && tabRef.current) {
      tabRef.current.classList.add(classNames.active);
    }
  }, [isActive, previousActiveTab]);

  useEffect(() => {
    if (!isActive || previousActiveTab === undefined) {
      return;
    }

    const tabEl = tabRef.current!;
    const prevTabEl = tabEl.parentElement!.children[previousActiveTab];
    if (!prevTabEl) {
      // The number of tabs in the parent component has decreased. It is necessary to add the active tab class name.
      if (isActive && !tabEl.classList.contains(classNames.active)) {
        requestMutation(() => {
          tabEl.classList.add(classNames.active);
        });
      }
      return;
    }

    const platformEl = tabEl.querySelector<HTMLElement>('.platform')!;
    const prevPlatformEl = prevTabEl.querySelector<HTMLElement>('.platform')!;

    // We move and resize the platform, so it repeats the position and size of the previous one
    const shiftLeft = prevPlatformEl.parentElement!.offsetLeft - platformEl.parentElement!.offsetLeft;
    const scaleFactor = prevPlatformEl.clientWidth / platformEl.clientWidth;

    requestMutation(() => {
      prevPlatformEl.classList.remove('animate');
      platformEl.classList.remove('animate');
      platformEl.style.transform = `translate3d(${shiftLeft}px, 0, 0) scale3d(${scaleFactor}, 1, 1)`;

      requestForcedReflow(() => {
        forceReflow(platformEl);

        return () => {
          platformEl.classList.add('animate');
          platformEl.style.transform = 'none';

          prevTabEl.classList.remove(classNames.active);
          tabEl.classList.add(classNames.active);
        };
      });
    });
  }, [isActive, previousActiveTab]);

  const {
    contextMenuAnchor, handleContextMenu, handleBeforeContextMenu, handleContextMenuClose,
    handleContextMenuHide, isContextMenuOpen,
  } = useContextMenuHandlers(tabRef, !contextActions);

  const { handleClick, handleMouseDown } = useFastClick((e: React.MouseEvent<HTMLDivElement>) => {
    if (contextActions && (e.button === MouseButton.Secondary || !onClick)) {
      handleBeforeContextMenu(e);
    }

    if (e.type === 'mousedown' && e.button !== MouseButton.Main) {
      return;
    }

    onClick?.(clickArg!);
  });

  const getTriggerElement = useLastCallback(() => tabRef.current);
  const getRootElement = useLastCallback(
    () => (contextRootElementSelector ? tabRef.current!.closest(contextRootElementSelector) : document.body),
  );
  const getMenuElement = useLastCallback(
    () => document.querySelector('#portals')!.querySelector('.Tab-context-menu .bubble'),
  );
  const getLayout = useLastCallback(() => ({ withPortal: true }));

  return (
    <div
      className={buildClassName('Tab', onClick && 'Tab--interactive', className)}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      ref={tabRef}
    >
      <span className="Tab_inner">
        {typeof title === 'string' ? renderText(title) : title}
        {Boolean(badgeCount) && (
          <span className={buildClassName('badge', isBadgeActive && classNames.badgeActive)}>{badgeCount}</span>
        )}
        {isBlocked && <Icon name="lock-badge" className="blocked" />}
        <i className="platform" />
      </span>

      {contextActions && contextMenuAnchor !== undefined && (
        <Menu
          isOpen={isContextMenuOpen}
          anchor={contextMenuAnchor}
          getTriggerElement={getTriggerElement}
          getRootElement={getRootElement}
          getMenuElement={getMenuElement}
          getLayout={getLayout}
          className="Tab-context-menu"
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

export default Tab;
