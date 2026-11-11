import { memo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import ConfirmDialog from '../../ui/ConfirmDialog';

type OwnProps = {
  isOpen: boolean;
  onClose: NoneToVoidFunction;
};

const TerminateAllWebSessionsDialog = ({ isOpen, onClose }: OwnProps) => {
  const { terminateAllWebAuthorizations } = getActions();

  const lang = useLang();

  const handleConfirm = useLastCallback(() => {
    onClose();
    terminateAllWebAuthorizations();
  });

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      title={lang('AuthSessionsLogOutApplications')}
      text={lang('AreYouSureWebSessions')}
      confirmHandler={handleConfirm}
      confirmIsDestructive
    />
  );
};

export default memo(TerminateAllWebSessionsDialog);
