import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';
import { Bundles } from '../../util/moduleLoader';

import type { OwnProps } from './SafeLinkModal';

import useModuleLoader from '../../hooks/useModuleLoader';

const SafeLinkModalAsync: FC<OwnProps> = (props) => {
  const { url } = props;
  const SafeLinkModal = useModuleLoader(Bundles.Extra, 'SafeLinkModal', !url);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return SafeLinkModal ? <SafeLinkModal {...props} /> : undefined;
};

export default memo(SafeLinkModalAsync);
