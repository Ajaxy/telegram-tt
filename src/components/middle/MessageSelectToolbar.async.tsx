import type { OwnProps } from './MessageSelectToolbar';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const MessageSelectToolbarAsync = (props: OwnProps) => {
  const { isActive } = props;
  const MessageSelectToolbar = useModuleLoader(Bundles.Extra, 'MessageSelectToolbar', !isActive);

  return MessageSelectToolbar ? <MessageSelectToolbar {...props} /> : undefined;
};

export default MessageSelectToolbarAsync;
