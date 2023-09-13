import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './SponsoredMessageContextMenuContainer';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const SponsoredMessageContextMenuContainerAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const SponsoredMessageContextMenuContainer = useModuleLoader(
    Bundles.Extra, 'SponsoredMessageContextMenuContainer', !isOpen,
  );

  // eslint-disable-next-line react/jsx-props-no-spreading
  return SponsoredMessageContextMenuContainer ? <SponsoredMessageContextMenuContainer {...props} /> : undefined;
};

export default SponsoredMessageContextMenuContainerAsync;
