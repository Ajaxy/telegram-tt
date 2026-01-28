import type { FC } from '../../../../lib/teact/teact';
import { memo, useState } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import { selectTabState } from '../../../../global/selectors';
import ConfirmAgentModal from '.';

import useLastCallback from '../../../../hooks/useLastCallback';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

type StateProps = {
  isOpen: boolean;
  hasAcceptedRisk: boolean;
};

const ConfirmAgentModalContainer: FC<StateProps> = ({
  isOpen,
  hasAcceptedRisk: initialHasAcceptedRisk,
}) => {
  const { closeTelebizEnableAgentModal, confirmEnableTelebizAgent } = getActions();
  const lang = useTelebizLang();
  const [hasAcceptedRisk, setHasAcceptedRisk] = useState(initialHasAcceptedRisk);

  const handleClose = useLastCallback(() => {
    setHasAcceptedRisk(false);
    closeTelebizEnableAgentModal();
  });

  const handleConfirm = useLastCallback(() => {
    if (!hasAcceptedRisk) return;
    confirmEnableTelebizAgent();
    setHasAcceptedRisk(false);
  });

  const handleRiskCheckChange = useLastCallback(() => {
    setHasAcceptedRisk(!hasAcceptedRisk);
  });

  return (
    <ConfirmAgentModal
      isOpen={isOpen}
      onClose={handleClose}
      title={lang('Agent.EnableConfirmation.Title')}
      confirmLabel={lang('Agent.EnableConfirmation.Confirm')}
      confirmIsDestructive
      confirmHandler={handleConfirm}
      isConfirmDisabled={!hasAcceptedRisk}
      hasAcceptedRisk={hasAcceptedRisk}
      handleRiskCheckChange={handleRiskCheckChange}
    />
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    const tabState = selectTabState(global);

    return {
      isOpen: Boolean(tabState.enableAgentModal?.isOpen),
      hasAcceptedRisk: Boolean(tabState.enableAgentModal?.hasAcceptedRisk),
    };
  },
)(ConfirmAgentModalContainer));
