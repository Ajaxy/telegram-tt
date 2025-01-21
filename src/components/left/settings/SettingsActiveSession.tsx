import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiSession } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import { formatDateTimeToString } from '../../../util/dates/dateFormat';
import getSessionIcon from './helpers/getSessionIcon';

import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useOldLang from '../../../hooks/useOldLang';

import Icon from '../../common/icons/Icon';
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
  const lang = useOldLang();

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
        <Button round color="translucent" size="smaller" ariaLabel={lang('Close')} onClick={onClose}>
          <Icon name="close" />
        </Button>
        <div className="modal-title">{lang('SessionPreview.Title')}</div>
        <Button
          color="danger"
          onClick={handleTerminateSessionClick}
          className={buildClassName('modal-action-button', styles.headerButton)}
        >
          {lang('SessionPreview.TerminateSession')}
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
      <div className={styles.date} aria-label={lang('PrivacySettings.LastSeen')}>
        {formatDateTimeToString(renderingSession.dateActive * 1000, lang.code)}
      </div>

      <dl className={styles.box}>
        <dt>{lang('SessionPreview.App')}</dt>
        <dd>
          {renderingSession?.appName} {renderingSession?.appVersion},{' '}
          {renderingSession?.platform} {renderingSession?.systemVersion}
        </dd>

        <dt>{lang('SessionPreview.Ip')}</dt>
        <dd>{renderingSession?.ip}</dd>

        <dt>{lang('SessionPreview.Location')}</dt>
        <dd>{renderingSession && getLocation(renderingSession)}</dd>
      </dl>

      <p className={styles.note}>{lang('SessionPreview.IpDesc')}</p>

      <h4 className={styles.actionHeader}>{lang('AuthSessions.View.AcceptTitle')}</h4>

      <ListItem onClick={handleSecretChatsStateChange}>
        <span className={styles.actionName}>{lang('SessionPreview.Accept.Secret')}</span>
        <Switcher
          id="accept_secrets"
          label="On"
          checked={renderingSession.areSecretChatsEnabled}
        />
      </ListItem>
      <ListItem onClick={handleCallsStateChange}>
        <span className={styles.actionName}>{lang('SessionPreview.Accept.Calls')}</span>
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
