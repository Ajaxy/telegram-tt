import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import type { OwnProps } from './MessageSelectToolbar';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const MessageSelectToolbarAsync: FC<OwnProps> = (props) => {
  const { isActive } = props;
  const MessageSelectToolbar = useModuleLoader(Bundles.Extra, 'MessageSelectToolbar', !isActive);

  return MessageSelectToolbar ? <MessageSelectToolbar {...props} /> : undefined;
};

export default MessageSelectToolbarAsync;
