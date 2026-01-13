import type { OwnProps } from './AboutStarGiftModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const AboutStarGiftModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const AboutStarGiftModal = useModuleLoader(Bundles.Stars, 'AboutStarGiftModal', !modal);

  return AboutStarGiftModal ? <AboutStarGiftModal {...props} /> : undefined;
};

export default AboutStarGiftModalAsync;
