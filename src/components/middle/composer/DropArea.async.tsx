import type { OwnProps } from './DropArea';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const DropAreaAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const DropArea = useModuleLoader(Bundles.Extra, 'DropArea', !isOpen);

  return DropArea ? <DropArea {...props} /> : undefined;
};

export default DropAreaAsync;
export { DropAreaState } from './DropArea';
