import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';
import { Bundles } from '../../../util/moduleLoader';

import type { OwnProps } from './ChatlistModal';

import useModuleLoader from '../../../hooks/useModuleLoader';

const ChatlistModalAsync: FC<OwnProps> = (props) => {
  const { info } = props;
  const ChatlistModal = useModuleLoader(Bundles.Extra, 'ChatlistModal', !info);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return ChatlistModal ? <ChatlistModal {...props} /> : undefined;
};

export default ChatlistModalAsync;
