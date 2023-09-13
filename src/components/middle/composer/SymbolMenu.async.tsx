import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './SymbolMenu';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const SymbolMenuAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const SymbolMenu = useModuleLoader(Bundles.Extra, 'SymbolMenu', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return SymbolMenu ? <SymbolMenu {...props} /> : undefined;
};

export default SymbolMenuAsync;
