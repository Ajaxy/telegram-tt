import type { FC } from '../../lib/teact/teact';
import React, { memo, useMemo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import buildClassName from '../../util/buildClassName';
import { copyTextToClipboard } from '../../util/clipboard';

import useAppLayout from '../../hooks/useAppLayout';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Button from '../ui/Button';
import DropdownMenu from '../ui/DropdownMenu';
import MenuItem from '../ui/MenuItem';
import Icon from './Icon';

import styles from './LinkField.module.scss';

type OwnProps = {
  title?: string;
  link: string;
  isDisabled?: boolean;
  className?: string;
  withShare?: boolean;
  onRevoke?: VoidFunction;
};

const InviteLink: FC<OwnProps> = ({
  title,
  link,
  isDisabled,
  className,
  withShare,
  onRevoke,
}) => {
  const lang = useLang();
  const { showNotification, openChatWithDraft } = getActions();

  const { isMobile } = useAppLayout();

  const isOnlyCopy = !onRevoke;

  const copyLink = useLastCallback(() => {
    copyTextToClipboard(link);
    showNotification({
      message: lang('LinkCopied'),
    });
  });

  const handleCopyClick = useLastCallback(() => {
    if (isDisabled) return;
    copyLink();
  });

  const handleShare = useLastCallback(() => {
    openChatWithDraft({ text: link });
  });

  const PrimaryLinkMenuButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isOpen }) => (
      <Button
        round
        ripple={!isMobile}
        size="smaller"
        color="translucent"
        className={isOpen ? 'active' : ''}
        onClick={onTrigger}
        ariaLabel={lang('AccDescrOpenMenu2')}
      >
        <i className="icon icon-more" />
      </Button>
    );
  }, [isMobile, lang]);

  return (
    <div className={className}>
      <p className={styles.title}>
        {lang(title || 'InviteLink.InviteLink')}
      </p>
      <div className={styles.primaryLink}>
        <input
          className={buildClassName('form-control', styles.input)}
          value={link}
          readOnly
          onClick={handleCopyClick}
        />
        {isOnlyCopy ? (
          <Button
            color="translucent"
            className={styles.copy}
            size="smaller"
            round
            disabled={isDisabled}
            onClick={handleCopyClick}
          >
            <Icon name="copy" />
          </Button>
        ) : (
          <DropdownMenu
            className={styles.moreMenu}
            trigger={PrimaryLinkMenuButton}
            positionX="right"
          >
            <MenuItem icon="copy" onClick={handleCopyClick} disabled={isDisabled}>{lang('Copy')}</MenuItem>
            {onRevoke && (
              <MenuItem icon="delete" onClick={onRevoke} destructive>{lang('RevokeButton')}</MenuItem>
            )}
          </DropdownMenu>
        )}
      </div>
      {withShare && (
        <Button
          size="smaller"
          disabled={isDisabled}
          onClick={handleShare}
        >
          {lang('FolderLinkScreen.LinkActionShare')}
        </Button>
      )}
    </div>
  );
};

export default memo(InviteLink);
