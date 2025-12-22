import type { OwnProps } from './AboutMonetizationModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const AboutMonetizationModalAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const AboutMonetizationModal = useModuleLoader(Bundles.Extra, 'AboutMonetizationModal', !isOpen);

  return AboutMonetizationModal ? <AboutMonetizationModal {...props} /> : undefined;
};

export default AboutMonetizationModalAsync;
