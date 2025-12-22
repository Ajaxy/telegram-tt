import type { OwnProps } from './PasskeyModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const PasskeyModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const PasskeyModal = useModuleLoader(Bundles.Extra, 'PasskeyModal', !modal);

  return PasskeyModal ? <PasskeyModal {...props} /> : undefined;
};

export default PasskeyModalAsync;
