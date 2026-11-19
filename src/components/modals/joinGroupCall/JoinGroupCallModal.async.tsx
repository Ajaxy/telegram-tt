import type { OwnProps } from './JoinGroupCallModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const JoinGroupCallModalAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const JoinGroupCallModal = useModuleLoader(Bundles.Extra, 'JoinGroupCallModal', !isOpen);

  return JoinGroupCallModal ? <JoinGroupCallModal {...props} /> : undefined;
};

export default JoinGroupCallModalAsync;
