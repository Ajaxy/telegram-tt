import Checkbox from '../../../../components/ui/Checkbox';
import ConfirmDialog from '../../../../components/ui/ConfirmDialog';

import styles from './ConfirmAgentModal.module.scss';

type OwnProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  confirmLabel: string;
  confirmIsDestructive: boolean;
  confirmHandler: () => void;
  isConfirmDisabled: boolean;
  hasAcceptedRisk: boolean;
  handleRiskCheckChange: () => void;
};

const ConfirmAgentModal = ({
  isOpen,
  onClose,
  title,
  confirmLabel,
  confirmIsDestructive,
  confirmHandler,
  isConfirmDisabled,
  hasAcceptedRisk,
  handleRiskCheckChange,
}: OwnProps) => {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      confirmLabel={confirmLabel}
      confirmIsDestructive={confirmIsDestructive}
      confirmHandler={confirmHandler}
      isConfirmDisabled={isConfirmDisabled}
      className={styles.enableAgentDialog}
    >
      <div className="dialog-paragraph">
        Agent Mode gives the AI assistant the ability to perform real actions on your Telegram account:
      </div>
      <ul className="dialog-list">
        <li>Send messages to any chat</li>
        <li>Archive, mute, or delete chats</li>
        <li>Manage chat folders</li>
        <li>Add or remove group members</li>
      </ul>
      <div className="dialog-paragraph">
        <strong>Risks to consider:</strong>
      </div>
      <ul className="dialog-list">
        <li>The AI may misunderstand your request and perform unintended actions</li>
        <li>Bulk operations could affect many chats at once</li>
        <li>Some actions cannot be undone</li>
        <li>Excessive API calls may trigger Telegram rate limits</li>
      </ul>
      <div className="dialog-paragraph">
        <strong>Best practices:</strong>
      </div>
      <ul className="dialog-list">
        <li>Start with small, specific requests</li>
        <li>Review the plan before confirming destructive actions</li>
        <li>Never ask it to message many users at once</li>
        <li>Use &ldquo;Ask&rdquo; mode for read-only queries</li>
      </ul>
      <div className="dialog-paragraph mt-4">
        <Checkbox
          checked={hasAcceptedRisk}
          label="I understand the risks and will use Agent Mode responsibly"
          onCheck={handleRiskCheckChange}
          className={styles.enableAgentDialogCheckbox}
        />
      </div>
    </ConfirmDialog>
  );
};

export default ConfirmAgentModal;
