import type { OwnProps } from './OneTimeMediaModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const OneTimeMediaModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const OneTimeMediaModal = useModuleLoader(Bundles.Extra, 'OneTimeMediaModal', !modal);

  return OneTimeMediaModal ? <OneTimeMediaModal {...props} /> : undefined;
};

export default OneTimeMediaModalAsync;
