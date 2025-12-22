import type { OwnProps } from './StatusPickerMenu';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const StatusPickerMenuAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const StatusPickerMenu = useModuleLoader(Bundles.Extra, 'StatusPickerMenu', !isOpen);

  return StatusPickerMenu ? <StatusPickerMenu {...props} /> : undefined;
};

export default StatusPickerMenuAsync;
