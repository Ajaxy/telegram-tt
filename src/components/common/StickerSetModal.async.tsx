import type { FC } from '../../lib/teact/teact';

import type { OwnProps } from './StickerSetModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const StickerSetModalAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const StickerSetModal = useModuleLoader(Bundles.Extra, 'StickerSetModal', !isOpen);

  return StickerSetModal ? <StickerSetModal {...props} /> : undefined;
};

export default StickerSetModalAsync;
