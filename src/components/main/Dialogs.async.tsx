import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const DialogsAsync: FC = ({ isOpen }) => {
  const Dialogs = useModuleLoader(Bundles.Extra, 'Dialogs', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return Dialogs ? <Dialogs /> : undefined;
};

export default DialogsAsync;
