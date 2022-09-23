import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';
import { Bundles } from '../../util/moduleLoader';
import type { OwnProps } from './ForwardRecipientPicker';

import useModuleLoader from '../../hooks/useModuleLoader';

const ForwardRecipientPickerAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const ForwardRecipientPicker = useModuleLoader(Bundles.Extra, 'ForwardRecipientPicker', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return ForwardRecipientPicker ? <ForwardRecipientPicker {...props} /> : undefined;
};

export default memo(ForwardRecipientPickerAsync);
