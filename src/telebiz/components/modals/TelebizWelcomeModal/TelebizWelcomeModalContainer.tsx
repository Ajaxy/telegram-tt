import { memo } from '@teact';
import { getActions, withGlobal } from '../../../../global';

import { selectIsTelebizAuthenticated, selectIsTelebizWelcomeModalOpen } from '../../../global/selectors';
import TelebizWelcomeModal from '.';

type StateProps = {
  isOpen: boolean;
  isAuthenticated: boolean;
};

const TelebizWelcomeModalContainer = ({
  isOpen,
  isAuthenticated,
}: StateProps) => {
  const { telebizLogin, telebizCloseWelcomeModal } = getActions();

  const handleClose = () => {
    if (isAuthenticated) {
      telebizCloseWelcomeModal();
    }
  };

  return (
    <TelebizWelcomeModal
      isOpen={isOpen}
      onClose={handleClose}
      onLogin={telebizLogin}
    />
  );
};

export default memo(withGlobal(
  (global): StateProps => ({
    isOpen: selectIsTelebizWelcomeModalOpen(global),
    isAuthenticated: selectIsTelebizAuthenticated(global),
  }),
)(TelebizWelcomeModalContainer));
