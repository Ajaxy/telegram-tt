import { memo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import ConfirmDialog from '../../ui/ConfirmDialog';

type OwnProps = {
  isOpen: boolean;
  onClose: NoneToVoidFunction;
};

const AskQuestionDialog = ({ isOpen, onClose }: OwnProps) => {
  const { openSupportChat } = getActions();

  const lang = useLang();

  const handleConfirm = useLastCallback(() => {
    openSupportChat();
    onClose();
  });

  return (
    <ConfirmDialog
      isOpen={isOpen}
      confirmLabel={lang('OK')}
      title={lang('AskAQuestion')}
      textParts={lang('MenuAskText', undefined, { withNodes: true, renderTextFilters: ['br'] })}
      confirmHandler={handleConfirm}
      onClose={onClose}
    />
  );
};

export default memo(AskQuestionDialog);
