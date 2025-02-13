import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiUser } from '../../../api/types';
import type { TabState } from '../../../global/types';

import { getUserFullName } from '../../../global/helpers';
import { selectUser } from '../../../global/selectors';
import { ensureProtocol } from '../../../util/ensureProtocol';
import renderText from '../../common/helpers/renderText';

import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useOldLang from '../../../hooks/useOldLang';

import Checkbox from '../../ui/Checkbox';
import ConfirmDialog from '../../ui/ConfirmDialog';

export type OwnProps = {
  modal?: TabState['urlAuth'];
};

type StateProps = {
  currentUser?: ApiUser;
};

const UrlAuthModal: FC<OwnProps & StateProps> = ({
  modal, currentUser,
}) => {
  const { closeUrlAuthModal, acceptBotUrlAuth, acceptLinkUrlAuth } = getActions();
  const [isLoginChecked, setLoginChecked] = useState(true);
  const [isWriteAccessChecked, setWriteAccessChecked] = useState(true);
  const currentAuth = useCurrentOrPrev(modal, false);
  const { domain, botId, shouldRequestWriteAccess } = currentAuth?.request || {};
  const bot = botId ? getGlobal().users.byId[botId] : undefined;

  const lang = useOldLang();

  const handleOpen = useCallback(() => {
    if (modal?.url && isLoginChecked) {
      const acceptAction = modal.button ? acceptBotUrlAuth : acceptLinkUrlAuth;
      acceptAction({
        isWriteAllowed: isWriteAccessChecked,
      });
    } else {
      window.open(ensureProtocol(currentAuth?.url), '_blank', 'noopener');
    }
    closeUrlAuthModal();
  }, [
    modal, isLoginChecked, closeUrlAuthModal, acceptBotUrlAuth, acceptLinkUrlAuth, isWriteAccessChecked, currentAuth,
  ]);

  const handleDismiss = useCallback(() => {
    closeUrlAuthModal();
  }, [closeUrlAuthModal]);

  const handleLoginChecked = useCallback((value: boolean) => {
    setLoginChecked(value);
    setWriteAccessChecked(value);
  }, [setLoginChecked]);

  // Reset on re-open
  useEffect(() => {
    if (domain) {
      setLoginChecked(true);
      setWriteAccessChecked(Boolean(shouldRequestWriteAccess));
    }
  }, [shouldRequestWriteAccess, domain]);

  return (
    <ConfirmDialog
      isOpen={Boolean(modal?.url)}
      onClose={handleDismiss}
      title={lang('OpenUrlTitle')}
      confirmLabel={lang('OpenUrlTitle')}
      confirmHandler={handleOpen}
    >
      {renderText(lang('OpenUrlAlert2', currentAuth?.url), ['links'])}
      {domain && (
        <Checkbox
          className="dialog-checkbox"
          checked={isLoginChecked}
          label={(
            <>
              {renderText(
                lang('Conversation.OpenBotLinkLogin', [domain, getUserFullName(currentUser)]),
                ['simple_markdown'],
              )}
            </>
          )}
          onCheck={handleLoginChecked}
        />
      )}
      {shouldRequestWriteAccess && (
        <Checkbox
          className="dialog-checkbox"
          checked={isWriteAccessChecked}
          label={(
            <>
              {renderText(
                lang('Conversation.OpenBotLinkAllowMessages', getUserFullName(bot)),
                ['simple_markdown'],
              )}
            </>
          )}
          onCheck={setWriteAccessChecked}
          disabled={!isLoginChecked}
        />
      )}
    </ConfirmDialog>
  );
};
export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const currentUser = selectUser(global, global.currentUserId!);
    return {
      currentUser,
    };
  },
)(UrlAuthModal));
