import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import type { IconName } from '../../types/icons';

import { IS_TEST } from '../../config';
import buildClassName from '../../util/buildClassName';

import useAppLayout from '../../hooks/useAppLayout';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import Icon from '../common/icons/Icon';

import './MenuItem.scss';

export type MenuItemProps = {
  customIcon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  onClick?: (e: React.SyntheticEvent<HTMLDivElement | HTMLAnchorElement>, arg?: number) => void;
  clickArg?: number;
  onContextMenu?: (e: React.UIEvent) => void;
  href?: string;
  download?: string;
  disabled?: boolean;
  destructive?: boolean;
  ariaLabel?: string;
  withWrap?: boolean;
  withPreventDefaultOnMouseDown?: boolean;
} & ({
  icon: 'A' | 'K';
  isCharIcon: true;
} | {
  icon?: IconName;
  isCharIcon?: false;
});

const MenuItem: FC<MenuItemProps> = (props) => {
  const {
    icon,
    isCharIcon,
    customIcon,
    className,
    children,
    onClick,
    href,
    download,
    disabled,
    destructive,
    ariaLabel,
    withWrap,
    onContextMenu,
    clickArg,
    withPreventDefaultOnMouseDown,
  } = props;

  const lang = useOldLang();
  const { isTouchScreen } = useAppLayout();
  const handleClick = useLastCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !onClick) {
      e.preventDefault();
      return;
    }
    onClick(e, clickArg);
  });

  const handleKeyDown = useLastCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.keyCode !== 13 && e.keyCode !== 32) {
      return;
    }

    if (disabled || !onClick) {
      e.preventDefault();

      return;
    }
    onClick(e, clickArg);
  });
  const handleMouseDown = useLastCallback((e: React.SyntheticEvent<HTMLDivElement | HTMLAnchorElement>) => {
    if (withPreventDefaultOnMouseDown) {
      e.preventDefault();
    }
  });

  const fullClassName = buildClassName(
    'MenuItem',
    className,
    disabled && 'disabled',
    destructive && 'destructive',
    !isTouchScreen && 'compact',
    withWrap && 'wrap',
  );

  const content = (
    <>
      {!customIcon && icon && (
        <Icon name={isCharIcon ? 'char' : icon} character={isCharIcon ? icon : undefined} />
      )}
      {customIcon}
      {children}
    </>
  );

  if (href) {
    return (
      <a
        tabIndex={0}
        className={fullClassName}
        href={href}
        download={download}
        aria-label={ariaLabel}
        title={ariaLabel}
        target={href.startsWith(window.location.origin) || IS_TEST ? '_self' : '_blank'}
        rel="noopener noreferrer"
        dir={lang.isRtl ? 'rtl' : undefined}
        onClick={onClick}
        onMouseDown={handleMouseDown}
      >
        {content}
      </a>
    );
  }

  return (
    <div
      role="menuitem"
      tabIndex={0}
      className={fullClassName}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
      onContextMenu={onContextMenu}
      aria-label={ariaLabel}
      title={ariaLabel}
      dir={lang.isRtl ? 'rtl' : undefined}
    >
      {content}
    </div>
  );
};

export default MenuItem;
