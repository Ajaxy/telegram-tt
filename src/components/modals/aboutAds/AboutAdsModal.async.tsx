import type { OwnProps } from './AboutAdsModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const AboutAdsModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const AboutAdsModal = useModuleLoader(Bundles.Extra, 'AboutAdsModal', !modal);

  return AboutAdsModal ? <AboutAdsModal {...props} /> : undefined;
};

export default AboutAdsModalAsync;
