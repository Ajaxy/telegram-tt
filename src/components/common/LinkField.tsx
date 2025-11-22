import type { FC } from '../../lib/teact/teact';
import { memo, useMemo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import buildClassName from '../../util/buildClassName';
import { copyTextToClipboard } from '../../util/clipboard';

import useAppLayout from '../../hooks/useAppLayout';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import Button from '../ui/Button';
import DropdownMenu from '../ui/DropdownMenu';
import MenuItem from '../ui/MenuItem';

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
  const oldLang = useOldLang();
  const { showNotification, openChatWithDraft } = getActions();

  const { isMobile } = useAppLayout();

  const isOnlyCopy = !onRevoke;

  const copyLink = useLastCallback(() => {
    copyTextToClipboard(link);
    showNotification({
      message: {
        key: 'LinkCopied',
      },
    });
  });

  const handleCopyClick = useLastCallback(() => {
    if (isDisabled) return;
    copyLink();
  });

  const handleShare = useLastCallback(() => {
    openChatWithDraft({ text: { text: link } });
  });

  const PrimaryLinkMenuButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isOpen }) => (
      <Button
        round
        ripple={!isMobile}
        size="smaller"
        color="translucent"
        className={isOpen ? 'active' : ''}
        iconName="more"
        onClick={onTrigger}
        ariaLabel={lang('AriaLabelOpenMenu')}
      />
    );
  }, [isMobile, lang]);

  return (
    <div className={className}>
      <p className={styles.title}>
        {oldLang(title || 'InviteLink.InviteLink')}
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
            iconName="copy"
            disabled={isDisabled}
            onClick={handleCopyClick}
          />
        ) : (
          <DropdownMenu
            className={styles.moreMenu}
            trigger={PrimaryLinkMenuButton}
            positionX="right"
          >
            <MenuItem icon="copy" onClick={handleCopyClick} disabled={isDisabled}>{oldLang('Copy')}</MenuItem>
            {onRevoke && (
              <MenuItem icon="delete" onClick={onRevoke} destructive>{oldLang('RevokeButton')}</MenuItem>
            )}
          </DropdownMenu>
        )}
      </div>
      {withShare && (
        <Button
          disabled={isDisabled}
          onClick={handleShare}
          className={styles.share}
        >
          {oldLang('FolderLinkScreen.LinkActionShare')}
        </Button>
      )}
    </div>
  );
};

export default memo(InviteLink);
