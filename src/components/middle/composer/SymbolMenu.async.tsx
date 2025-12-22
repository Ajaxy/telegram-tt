import type { OwnProps } from './SymbolMenu';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const SymbolMenuAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const SymbolMenu = useModuleLoader(Bundles.Extra, 'SymbolMenu', !isOpen);

  return SymbolMenu ? <SymbolMenu {...props} /> : undefined;
};

export default SymbolMenuAsync;
