import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';
import type { OwnProps } from './ReactionPicker';

import { Bundles } from '../../../util/moduleLoader';
import useModuleLoader from '../../../hooks/useModuleLoader';

interface LocalOwnProps {
  shouldLoad?: boolean;
}

const ReactionPickerAsync: FC<OwnProps & LocalOwnProps> = (props) => {
  const { isOpen, shouldLoad } = props;
  const ReactionPicker = useModuleLoader(Bundles.Extra, 'ReactionPicker', !isOpen && !shouldLoad);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return ReactionPicker ? <ReactionPicker {...props} /> : undefined;
};

export default ReactionPickerAsync;
