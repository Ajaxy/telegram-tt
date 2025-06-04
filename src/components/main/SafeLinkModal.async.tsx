import type { FC } from '../../lib/teact/teact';

import type { OwnProps } from './SafeLinkModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const SafeLinkModalAsync: FC<OwnProps> = (props) => {
  const { url } = props;
  const SafeLinkModal = useModuleLoader(Bundles.Extra, 'SafeLinkModal', !url);

  return SafeLinkModal ? <SafeLinkModal {...props} /> : undefined;
};

export default SafeLinkModalAsync;
