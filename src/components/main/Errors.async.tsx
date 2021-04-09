import React, { FC } from '../../lib/teact/teact';
import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const ErrorsAsync: FC = ({ isOpen }) => {
  const Errors = useModuleLoader(Bundles.Extra, 'Errors', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return Errors ? <Errors /> : undefined;
};

export default ErrorsAsync;
