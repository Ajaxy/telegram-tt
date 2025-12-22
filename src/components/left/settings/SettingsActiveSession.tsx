import type { FC } from '../../../lib/teact/teact';
import { memo, useCallback } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiSession } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import { formatDateTimeToString } from '../../../util/dates/dateFormat';
import getSessionIcon from './helpers/getSessionIcon';

import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useLang from '../../../hooks/useLang';

import Button from '../../ui/Button';
import ListItem from '../../ui/ListItem';
import Modal from '../../ui/Modal';
import Switcher from '../../ui/Switcher';

import styles from './SettingsActiveSession.module.scss';

type OwnProps = {
  isOpen: boolean;
  hash?: string;
  onClose: () => void;
};

type StateProps = {
  session?: ApiSession;
};

const SettingsActiveSession: FC<OwnProps & StateProps> = ({
  isOpen, session, onClose,
}) => {
  const { changeSessionSettings, terminateAuthorization } = getActions();
  const lang = useLang();

  const renderingSession = useCurrentOrPrev(session, true);

  const handleSecretChatsStateChange = useCallback(() => {
    changeSessionSettings({
      hash: session!.hash,
      areSecretChatsEnabled: !session!.areSecretChatsEnabled,
    });
  }, [changeSessionSettings, session]);

  const handleCallsStateChange = useCallback(() => {
    changeSessionSettings({
      hash: session!.hash,
      areCallsEnabled: !session!.areCallsEnabled,
    });
  }, [changeSessionSettings, session]);

  const handleTerminateSessionClick = useCallback(() => {
    terminateAuthorization({ hash: session!.hash });
    onClose();
  }, [onClose, session, terminateAuthorization]);

  if (!renderingSession) {
    return undefined;
  }

  function renderHeader() {
    return (
      <div className="modal-header-condensed" dir={lang.isRtl ? 'rtl' : undefined}>
        <Button
          round
          color="translucent"
          size="tiny"
          ariaLabel={lang('Close')}
          onClick={onClose}
          iconName="close"
        />
        <div className="modal-title">{lang('SessionPreviewTitle')}</div>
        <Button
          color="danger"
          onClick={handleTerminateSessionClick}
          className={buildClassName('modal-action-button', styles.headerButton)}
        >
          {lang('SessionPreviewTerminateSession')}
        </Button>
      </div>
    );
  }
  return (
    <Modal
      header={renderHeader()}
      isOpen={isOpen}
      hasCloseButton
      onClose={onClose}
      className={styles.SettingsActiveSession}
    >
      <div className={buildClassName(
        styles.iconDevice,
        renderingSession && styles[`iconDevice__${getSessionIcon(renderingSession)}`],
      )}
      />
      <h3 className={styles.title} dir="auto">{renderingSession?.deviceModel}</h3>
      <div className={styles.date} aria-label={lang('PrivacySettingsLastSeen')}>
        {formatDateTimeToString(renderingSession.dateActive * 1000, lang.code)}
      </div>

      <dl className={styles.box}>
        <dt>{lang('SessionPreviewApp')}</dt>
        <dd>
          {renderingSession?.appName}
          {' '}
          {renderingSession?.appVersion}
          ,
          {' '}
          {renderingSession?.platform}
          {' '}
          {renderingSession?.systemVersion}
        </dd>
        {renderingSession?.ip && (
          <>
            <dt>{lang('SessionPreviewIp')}</dt>
            <dd>{renderingSession.ip}</dd>
          </>
        )}

        <dt>{lang('SessionPreviewLocation')}</dt>
        <dd>{renderingSession && getLocation(renderingSession)}</dd>
      </dl>

      <p className={styles.note}>{lang('SessionPreviewIpDesc')}</p>

      <h4 className={styles.actionHeader}>{lang('AuthSessionsViewAcceptTitle')}</h4>

      <ListItem onClick={handleSecretChatsStateChange}>
        <span className={styles.actionName}>{lang('SessionPreviewAcceptSecret')}</span>
        <Switcher
          id="accept_secrets"
          label="On"
          checked={renderingSession.areSecretChatsEnabled}
        />
      </ListItem>
      <ListItem onClick={handleCallsStateChange}>
        <span className={styles.actionName}>{lang('SessionPreviewAcceptCalls')}</span>
        <Switcher
          id="accept_calls"
          label="On"
          checked={renderingSession.areCallsEnabled}
        />
      </ListItem>
    </Modal>
  );
};

function getLocation(session: ApiSession) {
  return [session.region, session.country].filter(Boolean).join(', ');
}

export default memo(withGlobal<OwnProps>((global, { hash }) => {
  return {
    session: hash ? global.activeSessions.byHash[hash] : undefined,
  };
})(SettingsActiveSession));
