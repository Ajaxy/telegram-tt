import { memo } from '../../../lib/teact/teact';

import { formatTonShortFromNanos } from '../../../util/formatCurrency';

import useLang from '../../../hooks/useLang';

import ConfirmDialog from '../../ui/ConfirmDialog';

type OwnProps = {
  isOpen: boolean;
  // Nanotons; absent when the relayer paid
  fee?: bigint;
  freeTransfersPerDay: number;
  onClose: NoneToVoidFunction;
};

const WalletFeesInfoDialog = ({
  isOpen, fee, freeTransfersPerDay, onClose,
}: OwnProps) => {
  const lang = useLang();

  const text = fee
    ? lang('WalletNetworkFeesInfo', {
      fee: formatTonShortFromNanos(fee),
      count: freeTransfersPerDay,
    }, { withNodes: true, withMarkdown: true, pluralValue: freeTransfersPerDay })
    : lang('WalletNetworkFeesInfoShort', {
      count: freeTransfersPerDay,
    }, { withNodes: true, withMarkdown: true, pluralValue: freeTransfersPerDay });

  return (
    <ConfirmDialog
      isOpen={isOpen}
      title={lang('WalletNetworkFeesTitle')}
      textParts={<p>{text}</p>}
      confirmLabel={lang('OK')}
      isOnlyConfirm
      confirmHandler={onClose}
      onClose={onClose}
    />
  );
};

export default memo(WalletFeesInfoDialog);
