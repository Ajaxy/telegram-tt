import type { FC } from '../../lib/teact/teact';

import type { OwnProps } from './SeenByModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const SeenByModalAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const SeenByModal = useModuleLoader(Bundles.Extra, 'SeenByModal', !isOpen);

  return SeenByModal ? <SeenByModal {...props} /> : undefined;
};

export default SeenByModalAsync;
