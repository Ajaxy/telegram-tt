import React, {
  memo, useCallback, useEffect, useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal } from '../../global';

import type { FC } from '../../lib/teact/teact';
import type { ApiUser } from '../../api/types';
import type { GlobalState } from '../../global/types';

import { ensureProtocol } from '../../util/ensureProtocol';
import renderText from '../common/helpers/renderText';
import { getUserFullName } from '../../global/helpers';

import useLang from '../../hooks/useLang';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';

import ConfirmDialog from '../ui/ConfirmDialog';
import Checkbox from '../ui/Checkbox';

import styles from './UrlAuthModal.module.scss';

export type OwnProps = {
  urlAuth?: GlobalState['urlAuth'];
  currentUser?: ApiUser;
};

const UrlAuthModal: FC<OwnProps> = ({
  urlAuth, currentUser,
}) => {
  const { closeUrlAuthModal, acceptBotUrlAuth, acceptLinkUrlAuth } = getActions();
  const [isLoginChecked, setLoginChecked] = useState(true);
  const [isWriteAccessChecked, setWriteAccessChecked] = useState(true);
  const currentAuth = useCurrentOrPrev(urlAuth, false);
  const { domain, botId, shouldRequestWriteAccess } = currentAuth?.request || {};
  const bot = botId ? getGlobal().users.byId[botId] : undefined;

  const lang = useLang();

  const handleOpen = useCallback(() => {
    if (urlAuth?.url && isLoginChecked) {
      const acceptAction = urlAuth.button ? acceptBotUrlAuth : acceptLinkUrlAuth;
      acceptAction({
        isWriteAllowed: isWriteAccessChecked,
      });
    } else {
      window.open(ensureProtocol(currentAuth?.url), '_blank', 'noopener');
    }
    closeUrlAuthModal();
  }, [
    urlAuth, isLoginChecked, closeUrlAuthModal, acceptBotUrlAuth, acceptLinkUrlAuth, isWriteAccessChecked, currentAuth,
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
      isOpen={Boolean(urlAuth?.url)}
      onClose={handleDismiss}
      title={lang('OpenUrlTitle')}
      confirmLabel={lang('OpenUrlTitle')}
      confirmHandler={handleOpen}
    >
      {renderText(lang('OpenUrlAlert2', currentAuth?.url), ['links'])}
      {domain && (
        <Checkbox
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
          className={styles.checkbox}
        />
      )}
      {shouldRequestWriteAccess && (
        <Checkbox
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
          className={styles.checkbox}
        />
      )}
    </ConfirmDialog>
  );
};

export default memo(UrlAuthModal);
