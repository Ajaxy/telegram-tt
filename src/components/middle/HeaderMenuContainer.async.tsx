import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import type { OwnProps } from './HeaderMenuContainer';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const HeaderMenuContainerAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const HeaderMenuContainer = useModuleLoader(Bundles.Extra, 'HeaderMenuContainer', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return HeaderMenuContainer ? <HeaderMenuContainer {...props} /> : undefined;
};

export default HeaderMenuContainerAsync;
