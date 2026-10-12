import type { OwnProps } from './CatchUpModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const CatchUpModalAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const CatchUpModal = useModuleLoader(Bundles.Extra, 'CatchUpModal', !isOpen);

  return CatchUpModal ? <CatchUpModal {...props} /> : undefined;
};

export default CatchUpModalAsync;
