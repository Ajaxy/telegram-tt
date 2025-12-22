import type { OwnProps } from './HeaderMenuContainer';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const HeaderMenuContainerAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const HeaderMenuContainer = useModuleLoader(Bundles.Extra, 'HeaderMenuContainer', !isOpen);

  return HeaderMenuContainer ? <HeaderMenuContainer {...props} /> : undefined;
};

export default HeaderMenuContainerAsync;
