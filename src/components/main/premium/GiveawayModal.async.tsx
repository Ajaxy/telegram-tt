import type { FC } from '../../../lib/teact/teact';

import type { OwnProps } from './GiveawayModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const GiveawayModalAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const GiveawayModal = useModuleLoader(Bundles.Extra, 'GiveawayModal', !isOpen);

  return GiveawayModal ? <GiveawayModal {...props} /> : undefined;
};

export default GiveawayModalAsync;
