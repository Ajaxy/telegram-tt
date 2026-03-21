import { memo } from '../../../../lib/teact/teact';

import type { OwnProps } from './GiftCraftSelectModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const GiftCraftSelectModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const GiftCraftSelectModal = useModuleLoader(Bundles.Stars, 'GiftCraftSelectModal', !modal);

  return GiftCraftSelectModal ? <GiftCraftSelectModal {...props} /> : undefined;
};

export default memo(GiftCraftSelectModalAsync);
