import type { OwnProps } from './ChatCommandTooltip';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const ChatCommandTooltipAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const ChatCommandTooltip = useModuleLoader(Bundles.Extra, 'ChatCommandTooltip', !isOpen);

  return ChatCommandTooltip ? <ChatCommandTooltip {...props} /> : undefined;
};

export default ChatCommandTooltipAsync;
