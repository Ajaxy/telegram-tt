import type { OwnProps } from './SafeLinkModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const SafeLinkModalAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const SafeLinkModal = useModuleLoader(Bundles.Extra, 'SafeLinkModal', !isOpen);

  return SafeLinkModal ? <SafeLinkModal {...props} /> : undefined;
};

export default SafeLinkModalAsync;
