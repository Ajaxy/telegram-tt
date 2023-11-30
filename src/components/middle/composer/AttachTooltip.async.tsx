import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './AttachTooltip';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const AttachTooltipAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const AttachTooltip = useModuleLoader(Bundles.Extra, 'AttachTooltip', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return AttachTooltip ? <AttachTooltip {...props} /> : undefined;
};

export default AttachTooltipAsync;
