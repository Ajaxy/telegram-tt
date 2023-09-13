import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import type { OwnProps } from './ReactorListModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const ReactorListModalAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const ReactorListModal = useModuleLoader(Bundles.Extra, 'ReactorListModal', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return ReactorListModal ? <ReactorListModal {...props} /> : undefined;
};

export default ReactorListModalAsync;
