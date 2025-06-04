import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import type { OwnProps } from './CustomEmojiSetsModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const CustomEmojiSetsModalAsync: FC<OwnProps> = (props) => {
  const { customEmojiSetIds } = props;
  const CustomEmojiSetsModal = useModuleLoader(Bundles.Extra, 'CustomEmojiSetsModal', !customEmojiSetIds);

  return CustomEmojiSetsModal ? <CustomEmojiSetsModal {...props} /> : undefined;
};

export default CustomEmojiSetsModalAsync;
