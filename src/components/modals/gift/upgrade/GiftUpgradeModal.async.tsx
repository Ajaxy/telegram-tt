import type { OwnProps } from './GiftUpgradeModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const GiftUpgradeModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const GiftUpgradeModal = useModuleLoader(Bundles.Stars, 'GiftUpgradeModal', !modal);

  return GiftUpgradeModal ? <GiftUpgradeModal {...props} /> : undefined;
};

export default GiftUpgradeModalAsync;
