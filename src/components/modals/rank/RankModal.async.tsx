import type { OwnProps } from './RankModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const RankModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const RankModal = useModuleLoader(Bundles.Extra, 'RankModal', !modal);

  return RankModal ? <RankModal {...props} /> : undefined;
};

export default RankModalAsync;
