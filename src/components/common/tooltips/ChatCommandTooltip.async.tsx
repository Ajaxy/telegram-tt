import type { OwnProps } from './ChatCommandTooltip';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const ChatCommandTooltipAsync = (props: OwnProps) => {
  const ChatCommandTooltip = useModuleLoader(Bundles.Extra, 'ChatCommandTooltip');

  return ChatCommandTooltip ? <ChatCommandTooltip {...props} /> : undefined;
};

export default ChatCommandTooltipAsync;
