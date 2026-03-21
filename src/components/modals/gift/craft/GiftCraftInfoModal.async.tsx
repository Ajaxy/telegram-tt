import { memo } from '../../../../lib/teact/teact';

import type { OwnProps } from './GiftCraftInfoModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const GiftCraftInfoModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const GiftCraftInfoModal = useModuleLoader(Bundles.Stars, 'GiftCraftInfoModal', !modal);

  return GiftCraftInfoModal ? <GiftCraftInfoModal {...props} /> : undefined;
};

export default memo(GiftCraftInfoModalAsync);
