import type { OwnProps } from './SeenByModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const SeenByModalAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const SeenByModal = useModuleLoader(Bundles.Extra, 'SeenByModal', !isOpen);

  return SeenByModal ? <SeenByModal {...props} /> : undefined;
};

export default SeenByModalAsync;
