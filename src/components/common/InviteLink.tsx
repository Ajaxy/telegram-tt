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

import styles from './InviteLink.module.scss';

type OwnProps = {
  title?: string;
  inviteLink: string;
  isDisabled?: boolean;
  className?: string;
  onRevoke?: VoidFunction;
};

const InviteLink: FC<OwnProps> = ({
  title,
  inviteLink,
  isDisabled,
  className,
  onRevoke,
}) => {
  const lang = useLang();
  const { showNotification, openChatWithDraft } = getActions();

  const { isMobile } = useAppLayout();

  const copyLink = useLastCallback((link: string) => {
    copyTextToClipboard(link);
    showNotification({
      message: lang('LinkCopied'),
    });
  });

  const handleCopyPrimaryClicked = useLastCallback(() => {
    if (isDisabled) return;
    copyLink(inviteLink);
  });

  const handleShare = useLastCallback(() => {
    openChatWithDraft({ text: inviteLink });
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
          value={inviteLink}
          readOnly
          onClick={handleCopyPrimaryClicked}
        />
        <DropdownMenu
          className={styles.moreMenu}
          trigger={PrimaryLinkMenuButton}
          positionX="right"
        >
          <MenuItem icon="copy" onClick={handleCopyPrimaryClicked} disabled={isDisabled}>{lang('Copy')}</MenuItem>
          {onRevoke && (
            <MenuItem icon="delete" onClick={onRevoke} destructive>{lang('RevokeButton')}</MenuItem>
          )}
        </DropdownMenu>
      </div>
      <Button
        size="smaller"
        disabled={isDisabled}
        onClick={handleShare}
      >
        {lang('FolderLinkScreen.LinkActionShare')}
      </Button>
    </div>
  );
};

export default memo(InviteLink);
