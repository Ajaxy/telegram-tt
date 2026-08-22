import type { OwnProps } from './AutoDeleteTimerModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const AutoDeleteTimerModalAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const AutoDeleteTimerModal = useModuleLoader(Bundles.Extra, 'AutoDeleteTimerModal', !isOpen);

  return AutoDeleteTimerModal ? <AutoDeleteTimerModal {...props} /> : undefined;
};

export default AutoDeleteTimerModalAsync;
