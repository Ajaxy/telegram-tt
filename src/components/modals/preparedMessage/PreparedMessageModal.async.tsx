import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './PreparedMessageModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const PreparedMessageModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const PreparedMessageModal = useModuleLoader(Bundles.Extra, 'PreparedMessageModal', !modal);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return PreparedMessageModal ? <PreparedMessageModal {...props} /> : undefined;
};

export default PreparedMessageModalAsync;
