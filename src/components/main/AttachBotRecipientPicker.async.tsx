import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import type { OwnProps } from './AttachBotRecipientPicker';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const AttachBotRecipientPickerAsync: FC<OwnProps> = (props) => {
  const { requestedAttachBotInChat } = props;
  const AttachBotRecipientPicker = useModuleLoader(
    Bundles.Extra, 'AttachBotRecipientPicker', !requestedAttachBotInChat,
  );

  // eslint-disable-next-line react/jsx-props-no-spreading
  return AttachBotRecipientPicker ? <AttachBotRecipientPicker {...props} /> : undefined;
};

export default AttachBotRecipientPickerAsync;
