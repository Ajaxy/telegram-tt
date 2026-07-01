import type { OwnProps } from './AttachBotRecipientPicker';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const AttachBotRecipientPickerAsync = (props: OwnProps) => {
  const { requestedAttachBotInChat, requestedBotStartGroup } = props;
  const AttachBotRecipientPicker = useModuleLoader(
    Bundles.Extra, 'AttachBotRecipientPicker', !requestedAttachBotInChat && !requestedBotStartGroup,
  );

  return AttachBotRecipientPicker ? <AttachBotRecipientPicker {...props} /> : undefined;
};

export default AttachBotRecipientPickerAsync;
