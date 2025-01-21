import type { FC } from '../../../../lib/teact/teact';
import React from '../../../../lib/teact/teact';

import type { OwnProps } from './GiftUpgradeModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const GiftUpgradeModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const GiftUpgradeModal = useModuleLoader(Bundles.Stars, 'GiftUpgradeModal', !modal);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return GiftUpgradeModal ? <GiftUpgradeModal {...props} /> : undefined;
};

export default GiftUpgradeModalAsync;
