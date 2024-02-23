import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import type { OwnProps } from './ReadDateModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const ReadTimeModalAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const ReadTimeModal = useModuleLoader(Bundles.Extra, 'ReadTimeModal', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return ReadTimeModal ? <ReadTimeModal {...props} /> : undefined;
};

export default ReadTimeModalAsync;
