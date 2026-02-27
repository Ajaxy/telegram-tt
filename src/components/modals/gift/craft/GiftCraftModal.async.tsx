import { memo } from '../../../../lib/teact/teact';

import type { OwnProps } from './GiftCraftModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const GiftCraftModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const GiftCraftModal = useModuleLoader(Bundles.Stars, 'GiftCraftModal', !modal);

  return GiftCraftModal ? <GiftCraftModal {...props} /> : undefined;
};

export default memo(GiftCraftModalAsync);
