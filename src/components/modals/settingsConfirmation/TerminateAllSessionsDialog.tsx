import { memo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import ConfirmDialog from '../../ui/ConfirmDialog';

type OwnProps = {
  isOpen: boolean;
  onClose: NoneToVoidFunction;
};

const TerminateAllSessionsDialog = ({ isOpen, onClose }: OwnProps) => {
  const { terminateAllAuthorizations } = getActions();

  const lang = useLang();

  const handleConfirm = useLastCallback(() => {
    onClose();
    terminateAllAuthorizations();
  });

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      text={lang('AreYouSureSessions')}
      confirmLabel={lang('TerminateAllSessions')}
      confirmHandler={handleConfirm}
      confirmIsDestructive
      areButtonsInColumn
    />
  );
};

export default memo(TerminateAllSessionsDialog);
