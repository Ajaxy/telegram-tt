import React, { FC, memo } from '../../../lib/teact/teact';
import { OwnProps } from './ContextMenuContainer';
import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const ContextMenuContainerAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const ContextMenuContainer = useModuleLoader(Bundles.Extra, 'ContextMenuContainer', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return ContextMenuContainer ? <ContextMenuContainer {...props} /> : undefined;
};

export default memo(ContextMenuContainerAsync);
