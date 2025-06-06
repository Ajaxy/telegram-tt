import type { FC } from '../../../lib/teact/teact';
import {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { TabState } from '../../../global/types';

import { MINI_APP_TOS_URL } from '../../../config';
import renderText from '../../common/helpers/renderText';

import useOldLang from '../../../hooks/useOldLang';

import Checkbox from '../../ui/Checkbox';
import ConfirmDialog from '../../ui/ConfirmDialog';

export type OwnProps = {
  modal: TabState['requestedAttachBotInstall'];
};

const AttachBotInstallModal: FC<OwnProps> = ({
  modal,
}) => {
  const { confirmAttachBotInstall, cancelAttachBotInstall } = getActions();
  const bot = modal?.bot;

  const [isTosAccepted, setIsTosAccepted] = useState(false);

  const lang = useOldLang();

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
    const base = lang('lng_mini_apps_disclaimer_button');
    const split = base.split('{link}');
    const linkText = lang('lng_mini_apps_disclaimer_link');
    return [
      split[0],
      <a href={MINI_APP_TOS_URL} target="_blank" rel="noopener noreferrer">{linkText}</a>,
      split[1],
    ];
  }, [lang]);

  return (
    <ConfirmDialog
      isOpen={Boolean(bot)}
      onClose={cancelAttachBotInstall}
      title={lang('lng_mini_apps_disclaimer_title')}
      confirmHandler={handleConfirm}
      isConfirmDisabled={!isTosAccepted}
    >
      {renderText(lang('lng_mini_apps_disclaimer_text', bot?.shortName), ['simple_markdown'])}
      <Checkbox
        className="dialog-checkbox"
        checked={isTosAccepted}
        label={tosLabel}
        onCheck={setIsTosAccepted}
      />
      {renderText(lang('WebBot.Account.Desclaimer.Desc', bot?.shortName), ['simple_markdown'])}
    </ConfirmDialog>
  );
};

export default memo(AttachBotInstallModal);
