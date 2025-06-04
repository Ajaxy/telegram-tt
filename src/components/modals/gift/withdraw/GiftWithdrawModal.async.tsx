import type { FC } from '../../../../lib/teact/teact';

import type { OwnProps } from './GiftWithdrawModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const GiftWithdrawModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const GiftWithdrawModal = useModuleLoader(Bundles.Stars, 'GiftWithdrawModal', !modal);

  return GiftWithdrawModal ? <GiftWithdrawModal {...props} /> : undefined;
};

export default GiftWithdrawModalAsync;
