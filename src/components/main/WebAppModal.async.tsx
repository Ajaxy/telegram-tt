import React, { FC, memo } from '../../lib/teact/teact';
import { Bundles } from '../../util/moduleLoader';

import { OwnProps } from './WebAppModal';

import useModuleLoader from '../../hooks/useModuleLoader';

const WebAppModalAsync: FC<OwnProps> = (props) => {
  const { webApp } = props;
  const WebAppModal = useModuleLoader(Bundles.Extra, 'WebAppModal', !webApp);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return WebAppModal ? <WebAppModal {...props} /> : undefined;
};

export default memo(WebAppModalAsync);
