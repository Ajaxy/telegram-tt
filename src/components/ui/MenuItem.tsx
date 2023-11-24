import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { ApiPhoto, ApiUser } from '../../api/types';
import type { IconName } from '../../types/icons';

import { IS_TEST } from '../../config';
import { selectUser, selectUserFullInfo } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';

import useAppLayout from '../../hooks/useAppLayout';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import ProfilePhoto from '../common/ProfilePhoto';

import './MenuItem.scss';

export type MenuItemProps = {
  icon?: IconName | 'A' | 'K';
  isCharIcon?: boolean;
  customIcon?: React.ReactNode;
  customImage?: React.ReactNode;
  userProfile?: boolean;
  className?: string;
  isSelected?: boolean;
  shortcut?: string;
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
  user?: ApiUser;
  userPersonalPhoto?: ApiPhoto;
  userProfilePhoto?: ApiPhoto;
  userFallbackPhoto?: ApiPhoto;
};

function renderPhoto(
  user: ApiUser,
  userPersonalPhoto: ApiPhoto | undefined,
  userProfilePhoto: ApiPhoto | undefined,
  userFallbackPhoto: ApiPhoto | undefined,
): JSX.Element {
  const profilePhoto = userPersonalPhoto || userProfilePhoto || userFallbackPhoto;

  return (
    <ProfilePhoto
      user={user}
      photo={profilePhoto}
      canPlayVideo
    />
  );
}

const MenuItem: FC<MenuItemProps> = ({
  icon,
  isCharIcon,
  customIcon,
  customImage,
  userProfile,
  className,
  isSelected,
  shortcut,
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
  user,
  userPersonalPhoto,
  userProfilePhoto,
  userFallbackPhoto,
}) => {
  const lang = useLang();
  const { isTouchScreen } = useAppLayout();
  const handleClick = useLastCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !onClick) {
      e.stopPropagation();
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
      e.stopPropagation();
      e.preventDefault();

      return;
    }

    onClick(e, clickArg);
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
      {userProfile && user && (
        renderPhoto(user, userPersonalPhoto, userProfilePhoto, userFallbackPhoto)
      )}
      {customImage || (!customIcon && icon && !userProfile && (
        <i
          className={isCharIcon ? 'icon icon-char' : `icon icon-${icon}`}
          data-char={isCharIcon ? icon : undefined}
        />
      ))}
      {customIcon}
      {children}
      {isSelected && <i className="icon icon-check" id="icon-check" />}
      {shortcut && <span className="shortcut">{shortcut}</span>}
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
      role="menuitem"
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

export default memo(withGlobal<MenuItemProps>((global) => {
  const { currentUserId } = global;
  const user = selectUser(global, currentUserId!);
  const userFullInfo = selectUserFullInfo(global, currentUserId!);

  return {
    user,
    userPersonalPhoto: userFullInfo?.personalPhoto,
    userProfilePhoto: userFullInfo?.profilePhoto,
    userFallbackPhoto: userFullInfo?.fallbackPhoto,
  };
})(MenuItem));
