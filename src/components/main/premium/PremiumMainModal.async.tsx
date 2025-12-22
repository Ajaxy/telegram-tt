import type { OwnProps } from './PremiumMainModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const PremiumMainModalAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const PremiumMainModal = useModuleLoader(Bundles.Extra, 'PremiumMainModal', !isOpen);

  return PremiumMainModal ? <PremiumMainModal {...props} /> : undefined;
};

export default PremiumMainModalAsync;
