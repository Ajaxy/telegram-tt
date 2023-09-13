import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import type { OwnProps } from './AboutAdsModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const AboutAdsModalAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const AboutAdsModal = useModuleLoader(Bundles.Extra, 'AboutAdsModal', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return AboutAdsModal ? <AboutAdsModal {...props} /> : undefined;
};

export default AboutAdsModalAsync;
