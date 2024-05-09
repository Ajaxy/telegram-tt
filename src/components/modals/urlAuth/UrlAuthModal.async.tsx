import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './UrlAuthModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const UrlAuthModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const UrlAuthModal = useModuleLoader(Bundles.Extra, 'UrlAuthModal', !modal);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return UrlAuthModal ? <UrlAuthModal {...props} /> : undefined;
};

export default UrlAuthModalAsync;
