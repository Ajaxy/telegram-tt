import type { OwnProps } from './GiveawayModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const GiveawayModalAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const GiveawayModal = useModuleLoader(Bundles.Extra, 'GiveawayModal', !isOpen);

  return GiveawayModal ? <GiveawayModal {...props} /> : undefined;
};

export default GiveawayModalAsync;
