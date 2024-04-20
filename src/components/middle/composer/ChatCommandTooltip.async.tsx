import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './ChatCommandTooltip';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const ChatCommandTooltipAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const ChatCommandTooltip = useModuleLoader(Bundles.Extra, 'ChatCommandTooltip', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return ChatCommandTooltip ? <ChatCommandTooltip {...props} /> : undefined;
};

export default ChatCommandTooltipAsync;
