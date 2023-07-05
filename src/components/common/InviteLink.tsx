import React, { memo, useMemo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { FC } from '../../lib/teact/teact';

import { copyTextToClipboard } from '../../util/clipboard';
import buildClassName from '../../util/buildClassName';
import useLang from '../../hooks/useLang';
import useAppLayout from '../../hooks/useAppLayout';
import useLastCallback from '../../hooks/useLastCallback';

import DropdownMenu from '../ui/DropdownMenu';
import MenuItem from '../ui/MenuItem';
import Button from '../ui/Button';

import styles from './InviteLink.module.scss';

type OwnProps = {
  title?: string;
  inviteLink: string;
  onRevoke?: VoidFunction;
  isDisabled?: boolean;
};

const InviteLink: FC<OwnProps> = ({
  title,
  inviteLink,
  onRevoke,
  isDisabled,
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
        ariaLabel="Actions"
      >
        <i className="icon icon-more" />
      </Button>
    );
  }, [isMobile]);

  return (
    <div className="settings-item">
      <p className="text-muted">
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
      <div className={styles.buttons}>
        <Button
          onClick={handleCopyPrimaryClicked}
          className={styles.button}
          size="smaller"
          disabled={isDisabled}
        >
          {lang('FolderLinkScreen.LinkActionCopy')}
        </Button>
        <Button
          onClick={handleShare}
          className={styles.button}
          size="smaller"
          disabled={isDisabled}
        >
          {lang('FolderLinkScreen.LinkActionShare')}
        </Button>
      </div>
    </div>
  );
};

export default memo(InviteLink);
