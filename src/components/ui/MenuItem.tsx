import React, { FC, useCallback } from '../../lib/teact/teact';

import { IS_TEST } from '../../config';
import buildClassName from '../../util/buildClassName';
import useLang from '../../hooks/useLang';
import { IS_COMPACT_MENU } from '../../util/environment';

import './MenuItem.scss';

type OnClickHandler = (e: React.SyntheticEvent<HTMLDivElement | HTMLAnchorElement>) => void;

type OwnProps = {
  icon?: string;
  customIcon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  onClick?: OnClickHandler;
  onContextMenu?: (e: React.UIEvent) => void;
  href?: string;
  download?: string;
  disabled?: boolean;
  destructive?: boolean;
  ariaLabel?: string;
};

const MenuItem: FC<OwnProps> = (props) => {
  const {
    icon,
    customIcon,
    className,
    children,
    onClick,
    href,
    download,
    disabled,
    destructive,
    ariaLabel,
    onContextMenu,
  } = props;

  const lang = useLang();
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !onClick) {
      e.stopPropagation();
      e.preventDefault();

      return;
    }

    onClick(e);
  }, [disabled, onClick]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.keyCode !== 13 && e.keyCode !== 32) {
      return;
    }

    if (disabled || !onClick) {
      e.stopPropagation();
      e.preventDefault();

      return;
    }

    onClick(e);
  }, [disabled, onClick]);

  const fullClassName = buildClassName(
    'MenuItem',
    className,
    disabled && 'disabled',
    destructive && 'destructive',
    IS_COMPACT_MENU && 'compact',
  );

  const content = (
    <>
      {!customIcon && icon && (
        <i className={`icon-${icon}`} data-char={icon.startsWith('char-') ? icon.replace('char-', '') : undefined} />
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
      >
        {content}
      </a>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={fullClassName}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
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
