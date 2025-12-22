import type { OwnProps } from './SponsoredContextMenuContainer';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const SponsoredContextMenuContainerAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const SponsoredContextMenuContainer = useModuleLoader(
    Bundles.Extra, 'SponsoredContextMenuContainer', !isOpen,
  );

  return SponsoredContextMenuContainer ? <SponsoredContextMenuContainer {...props} /> : undefined;
};

export default SponsoredContextMenuContainerAsync;
