import { memo, useMemo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { RegularLangKey } from '../../types/language';

import buildClassName from '../../util/buildClassName';
import { copyTextToClipboard } from '../../util/clipboard';

import useAppLayout from '../../hooks/useAppLayout';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Button from '../ui/Button';
import DropdownMenu from '../ui/DropdownMenu';
import MenuItem from '../ui/MenuItem';

import styles from './LinkField.module.scss';

type OwnProps = {
  title?: string;
  titleKey?: RegularLangKey;
  link: string;
  isDisabled?: boolean;
  className?: string;
  withShare?: boolean;
  noTitle?: boolean;
  onRevoke?: VoidFunction;
};

const InviteLink = ({
  title,
  titleKey,
  link,
  isDisabled,
  className,
  withShare,
  noTitle,
  onRevoke,
}: OwnProps) => {
  const { showNotification, openChatWithDraft } = getActions();
  const lang = useLang();

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

  const PrimaryLinkMenuButton = useMemo(() => {
    return ({ onTrigger, isOpen }: { isOpen?: boolean; onTrigger: () => void }) => (
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
      {!noTitle && (
        <p className={styles.title}>
          {title ?? lang(titleKey || 'InviteLink')}
        </p>
      )}
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
            <MenuItem icon="copy" onClick={handleCopyClick} disabled={isDisabled}>{lang('Copy')}</MenuItem>
            {onRevoke && (
              <MenuItem icon="delete" onClick={onRevoke} destructive>{lang('RevokeButton')}</MenuItem>
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
          {lang('Share')}
        </Button>
      )}
    </div>
  );
};

export default memo(InviteLink);
