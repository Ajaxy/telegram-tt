import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';
import { Bundles } from '../../util/moduleLoader';
import type { OwnProps } from './MessageSelectToolbar';

import useModuleLoader from '../../hooks/useModuleLoader';

const MessageSelectToolbarAsync: FC<OwnProps> = (props) => {
  const { isActive } = props;
  const MessageSelectToolbar = useModuleLoader(Bundles.Extra, 'MessageSelectToolbar', !isActive);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return MessageSelectToolbar ? <MessageSelectToolbar {...props} /> : undefined;
};

export default memo(MessageSelectToolbarAsync);
