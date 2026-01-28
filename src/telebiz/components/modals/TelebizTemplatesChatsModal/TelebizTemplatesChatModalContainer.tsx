import { memo } from '@teact';
import { getActions, withGlobal } from '../../../../global';

import { selectTabState } from '../../../../global/selectors';
import { selectTelebizTemplatesChatsList } from '../../../global/selectors/templatesChats';
import TelebizTemplatesChatsModal from '.';

import useLastCallback from '../../../../hooks/useLastCallback';

type StateProps = {
  isOpen: boolean;
  templatesChats: string[];
};

const TelebizTemplatesChatModalContainer = ({
  isOpen,
  templatesChats,
}: StateProps) => {
  const {
    closeTelebizTemplatesChatsModal,
  } = getActions();

  const handleClose = useLastCallback(() => {
    closeTelebizTemplatesChatsModal();
  });

  if (!isOpen) {
    return undefined;
  }

  return (
    <TelebizTemplatesChatsModal
      isOpen={isOpen}
      onClose={handleClose}
      templatesChats={templatesChats}
    />
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    const tabState = selectTabState(global);

    return {
      isOpen: Boolean(tabState.isTemplatesChatsModalOpen),
      templatesChats: selectTelebizTemplatesChatsList(global),
    };
  },
)(TelebizTemplatesChatModalContainer));
