import {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { TabState } from '../../../global/types';

import { MINI_APP_TOS_URL } from '../../../config';
import renderText from '../../common/helpers/renderText';

import useLang from '../../../hooks/useLang';

import Checkbox from '../../ui/Checkbox';
import ConfirmDialog from '../../ui/ConfirmDialog';

export type OwnProps = {
  modal: TabState['requestedAttachBotInstall'];
};

const AttachBotInstallModal = ({
  modal,
}: OwnProps) => {
  const { confirmAttachBotInstall, cancelAttachBotInstall } = getActions();
  const bot = modal?.bot;

  const [isTosAccepted, setIsTosAccepted] = useState(false);

  const lang = useLang();

  const handleConfirm = useCallback(() => {
    confirmAttachBotInstall({
      isWriteAllowed: Boolean(bot?.shouldRequestWriteAccess),
    });
  }, [confirmAttachBotInstall, bot]);

  // Reset on re-open
  useEffect(() => {
    if (bot) {
      setIsTosAccepted(false);
    }
  }, [bot]);

  const tosLabel = useMemo(() => {
    return lang('MiniAppsDisclaimerButton', {
      link: (
        <a href={MINI_APP_TOS_URL} target="_blank" rel="noopener noreferrer">
          {lang('MiniAppsDisclaimerLink')}
        </a>
      ),
    }, { withNodes: true });
  }, [lang]);

  return (
    <ConfirmDialog
      isOpen={Boolean(bot)}
      onClose={cancelAttachBotInstall}
      title={lang('MiniAppsDisclaimerTitle')}
      confirmHandler={handleConfirm}
      isConfirmDisabled={!isTosAccepted}
    >
      {renderText(lang('MiniAppsDisclaimerText'), ['simple_markdown'])}
      <Checkbox
        className="dialog-checkbox"
        checked={isTosAccepted}
        label={tosLabel}
        onCheck={setIsTosAccepted}
      />
      {renderText(lang('WebBotAccountDesclaimerDesc', { bot: bot?.shortName }), ['simple_markdown'])}
    </ConfirmDialog>
  );
};

export default memo(AttachBotInstallModal);
