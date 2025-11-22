import type { FC } from '../../lib/teact/teact';
import { memo, useRef } from '../../lib/teact/teact';

import type { IconName } from '../../types/icons';

import buildClassName from '../../util/buildClassName';
import { formatIntegerCompact } from '../../util/textFormat';

import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import useLang from '../../hooks/useLang';
import useOldLang from '../../hooks/useOldLang';

import Button from '../ui/Button';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';

import styles from './ScrollDownButton.module.scss';

type OwnProps = {
  icon: IconName;
  ariaLabelLang: string;
  unreadCount?: number;
  onClick: VoidFunction;
  onReadAll?: VoidFunction;
  className?: string;
};

const ScrollDownButton: FC<OwnProps> = ({
  icon,
  ariaLabelLang,
  unreadCount,
  onClick,
  onReadAll,
  className,
}) => {
  const oldLang = useOldLang();
  const lang = useLang();

  const ref = useRef<HTMLDivElement>();
  const {
    isContextMenuOpen,
    handleContextMenu,
    handleContextMenuClose,
    handleContextMenuHide,
  } = useContextMenuHandlers(ref, !onReadAll);

  return (
    <div className={buildClassName(styles.root, className)} ref={ref}>
      <Button
        color="secondary"
        round
        className={styles.button}
        onClick={onClick}
        onContextMenu={handleContextMenu}
        ariaLabel={oldLang(ariaLabelLang)}
        iconName={icon}
        iconClassName={styles.icon}
      />
      {Boolean(unreadCount) && <div className={styles.unreadCount}>{formatIntegerCompact(lang, unreadCount)}</div>}
      {onReadAll && (
        <Menu
          isOpen={isContextMenuOpen}
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
          autoClose
          positionX="right"
          positionY="bottom"
        >
          <MenuItem icon="readchats" onClick={onReadAll}>{oldLang('MarkAllAsRead')}</MenuItem>
        </Menu>
      )}
    </div>
  );
};

export default memo(ScrollDownButton);
