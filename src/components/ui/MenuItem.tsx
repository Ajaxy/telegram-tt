import type { IconName } from '../../types/icons';

import { IS_TEST } from '../../config';
import buildClassName from '../../util/buildClassName';

import useAppLayout from '../../hooks/useAppLayout';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Icon from '../common/icons/Icon';

import './MenuItem.scss';

export type MenuItemProps = {
  customIcon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  href?: string;
  rel?: string;
  target?: string;
  download?: string;
  disabled?: boolean;
  destructive?: boolean;
  ariaLabel?: string;
  withWrap?: boolean;
  withPreventDefaultOnMouseDown?: boolean;
  clickArg?: number;
  onClick?: (e: React.SyntheticEvent<HTMLDivElement | HTMLAnchorElement>, arg?: number) => void;
  onContextMenu?: (e: React.UIEvent) => void;
} & ({
  icon: 'A' | 'K';
  isCharIcon: true;
} | {
  icon?: IconName;
  isCharIcon?: false;
});

const MenuItem = (props: MenuItemProps) => {
  const {
    icon,
    isCharIcon,
    customIcon,
    className,
    children,
    href,
    target,
    download,
    disabled,
    destructive,
    ariaLabel,
    withWrap,
    rel = 'noopener noreferrer',
    withPreventDefaultOnMouseDown,
    clickArg,
    onClick,
    onContextMenu,
  } = props;

  const lang = useLang();
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

  if (href && !disabled) {
    return (
      <a
        tabIndex={0}
        className={fullClassName}
        href={href}
        download={download}
        aria-label={ariaLabel}
        title={ariaLabel}
        target={target || (href.startsWith(window.location.origin) || IS_TEST ? '_self' : '_blank')}
        rel={rel}
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
