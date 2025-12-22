import type { OwnProps } from './RatePhoneCallModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const RatePhoneCallModalAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const RatePhoneCallModal = useModuleLoader(Bundles.Calls, 'RatePhoneCallModal', !isOpen);

  return RatePhoneCallModal ? <RatePhoneCallModal {...props} /> : undefined;
};

export default RatePhoneCallModalAsync;
