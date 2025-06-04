import type { FC } from '../../../lib/teact/teact';

import type { OwnProps } from './AboutAdsModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const AboutAdsModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const AboutAdsModal = useModuleLoader(Bundles.Extra, 'AboutAdsModal', !modal);

  return AboutAdsModal ? <AboutAdsModal {...props} /> : undefined;
};

export default AboutAdsModalAsync;
