import type { FC } from '../../../lib/teact/teact';

import type { OwnProps } from './OneTimeMediaModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const OneTimeMediaModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const OneTimeMediaModal = useModuleLoader(Bundles.Extra, 'OneTimeMediaModal', !modal);

  return OneTimeMediaModal ? <OneTimeMediaModal {...props} /> : undefined;
};

export default OneTimeMediaModalAsync;
