import type { FC } from '../../../lib/teact/teact';

import type { OwnProps } from './CollectibleInfoModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const CollectibleInfoModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const CollectibleInfoModal = useModuleLoader(Bundles.Extra, 'CollectibleInfoModal', !modal);

  return CollectibleInfoModal ? <CollectibleInfoModal {...props} /> : undefined;
};

export default CollectibleInfoModalAsync;
