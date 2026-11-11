import type { OwnProps } from './MediaAccessModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const MediaAccessModalAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const MediaAccessModal = useModuleLoader(Bundles.Extra, 'MediaAccessModal', !isOpen);

  return MediaAccessModal ? <MediaAccessModal {...props} /> : undefined;
};

export default MediaAccessModalAsync;
