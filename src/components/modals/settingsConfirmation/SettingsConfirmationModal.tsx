import { memo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { TabState } from '../../../global/types';
import type { SettingsConfirmation } from '../../../types';

import useLastCallback from '../../../hooks/useLastCallback';

import AskQuestionDialog from './AskQuestionDialog';
import SignOutDialog from './SignOutDialog';
import TerminateAllSessionsDialog from './TerminateAllSessionsDialog';
import TerminateAllWebSessionsDialog from './TerminateAllWebSessionsDialog';

export type OwnProps = {
  modal: NonNullable<TabState['settingsConfirmation']>;
  isOpen: boolean;
};

const DIALOGS = {
  askQuestion: AskQuestionDialog,
  logOut: SignOutDialog,
  terminateAllSessions: TerminateAllSessionsDialog,
  terminateAllWebSessions: TerminateAllWebSessionsDialog,
} satisfies Record<SettingsConfirmation, unknown>;

const SettingsConfirmationModal = ({ modal, isOpen }: OwnProps) => {
  const { closeSettingsConfirmation } = getActions();

  const handleClose = useLastCallback(() => {
    closeSettingsConfirmation();
  });

  const Dialog = DIALOGS[modal];

  return <Dialog isOpen={isOpen} onClose={handleClose} />;
};

export default memo(SettingsConfirmationModal);
