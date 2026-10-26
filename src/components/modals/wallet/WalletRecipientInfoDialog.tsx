import { memo } from '../../../lib/teact/teact';

import { getAddressGroupSeparator, getIsAlternateAddressGroup, splitAddressIntoGroups } from '../../../util/tonAddress';

import useLang from '../../../hooks/useLang';

import ConfirmDialog from '../../ui/ConfirmDialog';
import Link from '../../ui/Link';

import styles from './WalletRecipientInfoDialog.module.scss';

type OwnProps = {
  isOpen: boolean;
  address: string;
  recipientName?: string;
  title: string;
  onOpenChat: NoneToVoidFunction;
  onCopyAddress: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
};

const WalletRecipientInfoDialog = ({
  isOpen, address, recipientName, title, onOpenChat, onCopyAddress, onClose,
}: OwnProps) => {
  const lang = useLang();

  const groups = splitAddressIntoGroups(address);

  return (
    <ConfirmDialog
      isOpen={isOpen}
      title={title}
      textParts={(
        <>
          <p>
            {recipientName ? lang('WalletSendAddressLinked', {
              name: <Link isPrimary onClick={onOpenChat}>{recipientName}</Link>,
            }, { withNodes: true, withMarkdown: true }) : lang('WalletAddressNoLinkedAccount')}
          </p>
          <button type="button" className={styles.address} onClick={onCopyAddress}>
            {groups.map((group, index) => (
              <span key={index} className={getIsAlternateAddressGroup(index) ? styles.addressGroupMuted : undefined}>
                {group}
                {getAddressGroupSeparator(index, groups.length)}
              </span>
            ))}
          </button>
        </>
      )}
      confirmLabel={lang('OK')}
      isOnlyConfirm
      confirmHandler={onClose}
      onClose={onClose}
    />
  );
};

export default memo(WalletRecipientInfoDialog);
