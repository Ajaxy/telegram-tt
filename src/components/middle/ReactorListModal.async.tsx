import React, { FC, memo } from '../../lib/teact/teact';
import { OwnProps } from './ReactorListModal';
import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const ReactorListModalAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const ReactorListModal = useModuleLoader(Bundles.Extra, 'ReactorListModal', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return ReactorListModal ? <ReactorListModal {...props} /> : undefined;
};

export default memo(ReactorListModalAsync);
