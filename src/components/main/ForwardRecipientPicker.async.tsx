import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import type { OwnProps } from './ForwardRecipientPicker';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const ForwardRecipientPickerAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const ForwardRecipientPicker = useModuleLoader(Bundles.Extra, 'ForwardRecipientPicker', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return ForwardRecipientPicker ? <ForwardRecipientPicker {...props} /> : undefined;
};

export default ForwardRecipientPickerAsync;
