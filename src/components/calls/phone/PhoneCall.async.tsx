import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

type OwnProps = {
  isActive?: boolean;
};

const PhoneCallAsync: FC<OwnProps> = (props) => {
  const { isActive } = props;
  const PhoneCall = useModuleLoader(Bundles.Calls, 'PhoneCall', !isActive);

  return PhoneCall ? <PhoneCall /> : undefined;
};

export default PhoneCallAsync;
