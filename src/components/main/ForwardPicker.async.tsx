import React, { FC, memo } from '../../lib/teact/teact';
import { Bundles } from '../../util/moduleLoader';
import { OwnProps } from './ForwardPicker';

import useModuleLoader from '../../hooks/useModuleLoader';

const ForwardPickerAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const ForwardPicker = useModuleLoader(Bundles.Extra, 'ForwardPicker', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return ForwardPicker ? <ForwardPicker {...props} /> : undefined;
};

export default memo(ForwardPickerAsync);
