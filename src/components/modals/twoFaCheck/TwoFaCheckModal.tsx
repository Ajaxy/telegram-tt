import { memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { TabState } from '../../../global/types';
import { SettingsScreens } from '../../../types';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import ConfirmDialog from '../../ui/ConfirmDialog';

import styles from './TwoFaCheckModal.module.scss';

export type OwnProps = {
  modal: TabState['isTwoFaCheckModalOpen'];
};

type StateProps = {
  hasPassword?: boolean;
};

const TwoFaCheckModal = ({ modal, hasPassword }: OwnProps & StateProps) => {
  const {
    closeTwoFaCheckModal, openSettingsScreen,
  } = getActions();
  const lang = useLang();

  const isOpen = Boolean(modal);

  const handleEnableTwoFa = useLastCallback(() => {
    openSettingsScreen({ screen: SettingsScreens.TwoFaDisabled });
    closeTwoFaCheckModal();
  });

  return (
    <ConfirmDialog
      isOpen={isOpen}
      title={lang('SecurityCheck')}
      className={styles.dialog}
      confirmLabel={hasPassword ? lang('OK') : lang('SecurityCheckEnableTwoStep')}
      confirmHandler={hasPassword ? closeTwoFaCheckModal : handleEnableTwoFa}
      isOnlyConfirm={hasPassword}
      areButtonsInColumn={!hasPassword}
      onClose={closeTwoFaCheckModal}
    >
      <p>{lang('SecurityCheckInfo')}</p>
      <ul className={styles.list}>
        <li>{lang('SecurityCheckTwoStepEnabled', undefined, { withNodes: true, withMarkdown: true })}</li>
        <li>{lang('SecurityCheckTwoStepNotChanged', undefined, { withNodes: true, withMarkdown: true })}</li>
        <li>{lang('SecurityCheckLoggedIn', undefined, { withNodes: true, withMarkdown: true })}</li>
      </ul>
    </ConfirmDialog>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    return {
      hasPassword: global.settings.byKey.hasPassword,
    };
  },
)(TwoFaCheckModal));
