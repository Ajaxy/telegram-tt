import { memo } from '../../../lib/teact/teact';

import useLang from '../../../hooks/useLang';

import ConfirmDialog from '../../ui/ConfirmDialog';

type OwnProps = {
  isOpen: boolean;
  fiatFee?: string;
  freeTransfersPerDay: number;
  onClose: NoneToVoidFunction;
};

const WalletFeesInfoDialog = ({
  isOpen, fiatFee, freeTransfersPerDay, onClose,
}: OwnProps) => {
  const lang = useLang();

  const text = fiatFee
    ? lang('WalletNetworkFeesInfo', {
      fee: fiatFee,
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
