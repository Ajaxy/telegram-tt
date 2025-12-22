import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

type OwnProps = {
  isActive?: boolean;
};

const PhoneCallAsync = (props: OwnProps) => {
  const { isActive } = props;
  const PhoneCall = useModuleLoader(Bundles.Calls, 'PhoneCall', !isActive);

  return PhoneCall ? <PhoneCall /> : undefined;
};

export default PhoneCallAsync;
