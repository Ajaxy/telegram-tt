import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './DropArea';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const DropAreaAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const DropArea = useModuleLoader(Bundles.Extra, 'DropArea', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return DropArea ? <DropArea {...props} /> : undefined;
};

export default DropAreaAsync;
export { DropAreaState } from './DropArea';
