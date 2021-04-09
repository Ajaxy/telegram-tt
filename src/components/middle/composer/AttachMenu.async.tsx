import React, { FC } from '../../../lib/teact/teact';
import { OwnProps } from './AttachMenu';
import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const AttachMenuAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const AttachMenu = useModuleLoader(Bundles.Extra, 'AttachMenu', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return AttachMenu ? <AttachMenu {...props} /> : undefined;
};

export default AttachMenuAsync;
