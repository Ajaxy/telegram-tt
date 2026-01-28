import { memo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import { selectTabState } from '../../../../global/selectors';
import RemoveEntityFromChatConfirm from '.';

import useLastCallback from '../../../../hooks/useLastCallback';

type StateProps = {
  isOpen: boolean;
  title?: string;
};

const RemoveEntityFromChatDialogContainer = ({
  isOpen,
  title,
}: StateProps) => {
  const {
    closeTelebizRemoveEntityFromChatDialog,
    confirmTelebizRemoveEntityFromChat,
  } = getActions();

  const handleClose = useLastCallback(() => {
    closeTelebizRemoveEntityFromChatDialog();
  });

  const handleConfirm = useLastCallback((deleteFromProvider: boolean) => {
    confirmTelebizRemoveEntityFromChat({ deleteFromProvider });
  });

  if (!isOpen) return undefined;

  return (
    <RemoveEntityFromChatConfirm
      isOpen={isOpen}
      title={title}
      onConfirm={handleConfirm}
      onClose={handleClose}
    />
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    const tabState = selectTabState(global);
    const dialog = tabState.removeEntityFromChatDialog;

    return {
      isOpen: dialog?.isOpen || false,
      title: dialog?.title,
    };
  },
)(RemoveEntityFromChatDialogContainer));
