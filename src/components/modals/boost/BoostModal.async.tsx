import type { OwnProps } from './BoostModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const BoostModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const BoostModal = useModuleLoader(Bundles.Extra, 'BoostModal', !modal);

  return BoostModal ? <BoostModal {...props} /> : undefined;
};

export default BoostModalAsync;
