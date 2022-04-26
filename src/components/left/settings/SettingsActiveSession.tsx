import React, { FC, memo, useCallback } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { ApiSession } from '../../../api/types';

import { formatDateTimeToString } from '../../../util/dateFormat';
import useLang from '../../../hooks/useLang';
import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import getSessionIcon from './helpers/getSessionIcon';
import buildClassName from '../../../util/buildClassName';

import ListItem from '../../ui/ListItem';
import Modal from '../../ui/Modal';
import Switcher from '../../ui/Switcher';
import Button from '../../ui/Button';

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

  const handleCallsStateChange = useCallback(() => {
    changeSessionSettings({
      hash: session!.hash,
      areCallsEnabled: !session?.areCallsEnabled,
    });
  }, [changeSessionSettings, session]);

  const handleTerminateSessionClick = useCallback(() => {
    terminateAuthorization({ hash: session!.hash });
    onClose();
  }, [onClose, session, terminateAuthorization]);

  if (!renderingSession) {
    return undefined;
  }

  return (
    <Modal
      title={lang('SessionPreview.Title')}
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
          {renderingSession?.appName} {renderingSession?.appVersion},
          {renderingSession?.platform} {renderingSession?.systemVersion}
        </dd>

        <dt>{lang('SessionPreview.Ip')}</dt>
        <dd>{renderingSession?.ip}</dd>

        <dt>{lang('SessionPreview.Location')}</dt>
        <dd>{renderingSession && getLocation(renderingSession)}</dd>
      </dl>

      <p className={styles.note}>{lang('SessionPreview.IpDesc')}</p>

      <h4 className={styles.actionHeader}>{lang('SessionPreview.AcceptHeader')}</h4>

      <ListItem onClick={handleCallsStateChange}>
        <span className={styles.actionName}>{lang('SessionPreview.Accept.Calls')}</span>
        <Switcher
          id="darkmode"
          label="On"
          checked={renderingSession.areCallsEnabled}
        />
      </ListItem>

      <Button color="danger" onClick={handleTerminateSessionClick}>{lang('SessionPreview.TerminateSession')}</Button>
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
