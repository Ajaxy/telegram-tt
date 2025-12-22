import type { OwnProps } from './UrlAuthModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const UrlAuthModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const UrlAuthModal = useModuleLoader(Bundles.Extra, 'UrlAuthModal', !modal);

  return UrlAuthModal ? <UrlAuthModal {...props} /> : undefined;
};

export default UrlAuthModalAsync;
