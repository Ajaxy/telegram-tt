import type { OwnProps } from './PollModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const PollModalAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const PollModal = useModuleLoader(Bundles.Extra, 'PollModal', !isOpen);

  return PollModal ? <PollModal {...props} /> : undefined;
};

export default PollModalAsync;
