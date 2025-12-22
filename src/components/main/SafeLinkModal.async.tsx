import type { OwnProps } from './SafeLinkModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const SafeLinkModalAsync = (props: OwnProps) => {
  const { url } = props;
  const SafeLinkModal = useModuleLoader(Bundles.Extra, 'SafeLinkModal', !url);

  return SafeLinkModal ? <SafeLinkModal {...props} /> : undefined;
};

export default SafeLinkModalAsync;
