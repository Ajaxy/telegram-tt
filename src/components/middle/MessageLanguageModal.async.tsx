import React, { memo } from '../../lib/teact/teact';

import type { FC } from '../../lib/teact/teact';
import type { OwnProps } from './MessageLanguageModal';

import { Bundles } from '../../util/moduleLoader';
import useModuleLoader from '../../hooks/useModuleLoader';

const MessageLanguageModalAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const MessageLanguageModal = useModuleLoader(Bundles.Extra, 'MessageLanguageModal', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return MessageLanguageModal ? <MessageLanguageModal {...props} /> : undefined;
};

export default memo(MessageLanguageModalAsync);
