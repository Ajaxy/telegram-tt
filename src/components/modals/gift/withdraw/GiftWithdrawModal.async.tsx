import type { OwnProps } from './GiftWithdrawModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const GiftWithdrawModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const GiftWithdrawModal = useModuleLoader(Bundles.Stars, 'GiftWithdrawModal', !modal);

  return GiftWithdrawModal ? <GiftWithdrawModal {...props} /> : undefined;
};

export default GiftWithdrawModalAsync;
