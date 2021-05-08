import React, { FC, memo } from '../../../lib/teact/teact';
import { OwnProps } from './DropArea';
import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const DropAreaAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const DropArea = useModuleLoader(Bundles.Extra, 'DropArea', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return DropArea ? <DropArea {...props} /> : undefined;
};

export default memo(DropAreaAsync);
export { DropAreaState } from './DropArea';
