import { memo, useState } from '../../lib/teact/teact';
import { getActions, getPromiseActions } from '../../global';

import type { TabState } from '../../global/types';

import { getCurrentTabId } from '../../util/establishMultitabRole';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import ConfirmDialog from '../ui/ConfirmDialog';

type OwnProps = {
  request?: TabState['desktopSessionLinkRequest'];
};

const DesktopSessionLinkModal = ({ request }: OwnProps) => {
  const { cancelDesktopSessionLink } = getActions();
  const lang = useLang();
  const [isBusy, setIsBusy] = useState(false);

  const handleDismiss = useLastCallback(() => {
    if (isBusy) {
      return;
    }
    cancelDesktopSessionLink({ tabId: getCurrentTabId() });
  });

  const handleConfirm = useLastCallback(async () => {
    if (isBusy || !request) {
      return;
    }
    setIsBusy(true);
    try {
      await getPromiseActions().confirmDesktopSessionLink({ tabId: getCurrentTabId() });
    } finally {
      setIsBusy(false);
    }
  });

  return (
    <ConfirmDialog
      isOpen={Boolean(request)}
      onClose={handleDismiss}
      title={lang('DesktopLinkNativeTitle')}
      text={lang('DesktopLinkNativeMessage')}
      confirmLabel={lang('DesktopLinkNativeConfirm')}
      confirmHandler={handleConfirm}
      isConfirmDisabled={isBusy}
    />
  );
};

export default memo(DesktopSessionLinkModal);
