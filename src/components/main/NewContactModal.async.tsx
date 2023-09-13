import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import type { OwnProps } from './NewContactModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const NewContactModalAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const NewContactModal = useModuleLoader(Bundles.Extra, 'NewContactModal', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return NewContactModal ? <NewContactModal {...props} /> : undefined;
};

export default NewContactModalAsync;
