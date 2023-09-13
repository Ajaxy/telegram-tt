import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import type { OwnProps } from './StickerSetModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const StickerSetModalAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const StickerSetModal = useModuleLoader(Bundles.Extra, 'StickerSetModal', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return StickerSetModal ? <StickerSetModal {...props} /> : undefined;
};

export default StickerSetModalAsync;
