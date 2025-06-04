import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './StatusPickerMenu';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const StatusPickerMenuAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const StatusPickerMenu = useModuleLoader(Bundles.Extra, 'StatusPickerMenu', !isOpen);

  return StatusPickerMenu ? <StatusPickerMenu {...props} /> : undefined;
};

export default StatusPickerMenuAsync;
