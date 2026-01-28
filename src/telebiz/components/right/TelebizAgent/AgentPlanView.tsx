import { memo } from '../../../../lib/teact/teact';

import type { ConfirmationRequest, PlanStep } from '../../../agent/types';

import buildClassName from '../../../../util/buildClassName';

import Icon from '../../../../components/common/icons/Icon';

import styles from './TelebizAgent.module.scss';

interface OwnProps {
  confirmation: ConfirmationRequest;
  isExecuting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function getStepStatusIcon(status: PlanStep['status']) {
  switch (status) {
    case 'pending':
      return 'schedule';
    case 'running':
      return 'play';
    case 'completed':
      return 'check';
    case 'failed':
      return 'close';
    case 'skipped':
      return 'skip-next';
    default:
      return 'schedule';
  }
}

const AgentPlanView = ({
  confirmation,
  isExecuting,
  onConfirm,
  onCancel,
}: OwnProps) => {
  return (
    <div className={styles.planView}>
      <div className={styles.planHeader}>
        <div className={styles.planTitle}>
          <Icon name="warning" className={styles.warningIcon} />
          <span>Confirmation Required</span>
        </div>
        {confirmation.estimatedImpact.isDestructive && (
          <span className={styles.destructiveWarning}>Destructive action</span>
        )}
      </div>

      <div className={styles.planSteps}>
        {confirmation.steps.map((step) => (
          <div key={step.id} className={styles.planStep}>
            <div className={buildClassName(styles.stepIcon, styles[step.status])}>
              <Icon name={getStepStatusIcon(step.status)} />
            </div>
            <div className={styles.stepContent}>
              <div className={styles.stepName}>{step.tool}</div>
              <div className={styles.stepArgs}>
                {JSON.stringify(step.args, undefined, 2).substring(0, 100)}
                {JSON.stringify(step.args).length > 100 ? '...' : ''}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.planActions}>
        <button
          type="button"
          className={buildClassName(styles.confirmButton, styles.secondary)}
          onClick={onCancel}
          disabled={isExecuting}
        >
          Cancel
        </button>
        <button
          type="button"
          className={buildClassName(styles.confirmButton, styles.primary)}
          onClick={onConfirm}
          disabled={isExecuting}
        >
          {isExecuting ? 'Executing...' : 'Confirm'}
        </button>
      </div>
    </div>
  );
};

export default memo(AgentPlanView);
