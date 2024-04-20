import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import type { OwnProps } from './AppendEntityPickerModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const AppendEntityPickerModalAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const AppendEntityPickerModal = useModuleLoader(Bundles.Extra, 'AppendEntityPickerModal', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return AppendEntityPickerModal ? <AppendEntityPickerModal {...props} /> : undefined;
};

export default AppendEntityPickerModalAsync;
