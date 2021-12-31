import React, {
  FC, memo, useCallback, useEffect, useMemo,
} from '../../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../../lib/teact/teactn';

import { ApiSession } from '../../../api/types';
import { SettingsScreens } from '../../../types';

import { formatPastTimeShort } from '../../../util/dateFormat';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useHistoryBack from '../../../hooks/useHistoryBack';

import ListItem from '../../ui/ListItem';
import ConfirmDialog from '../../ui/ConfirmDialog';

type OwnProps = {
  isActive?: boolean;
  onScreenSelect: (screen: SettingsScreens) => void;
  onReset: () => void;
};

type StateProps = {
  activeSessions: ApiSession[];
};

const SettingsPrivacyActiveSessions: FC<OwnProps & StateProps> = ({
  isActive,
  onScreenSelect,
  onReset,
  activeSessions,
}) => {
  const {
    loadAuthorizations,
    terminateAuthorization,
    terminateAllAuthorizations,
  } = getDispatch();

  const [isConfirmTerminateAllDialogOpen, openConfirmTerminateAllDialog, closeConfirmTerminateAllDialog] = useFlag();
  useEffect(() => {
    loadAuthorizations();
  }, [loadAuthorizations]);

  const handleTerminateSessionClick = useCallback((hash: string) => {
    terminateAuthorization({ hash });
  }, [terminateAuthorization]);

  const handleTerminateAllSessions = useCallback(() => {
    closeConfirmTerminateAllDialog();
    terminateAllAuthorizations();
  }, [closeConfirmTerminateAllDialog, terminateAllAuthorizations]);

  const currentSession = useMemo(() => {
    return activeSessions.find((session) => session.isCurrent);
  }, [activeSessions]);

  const otherSessions = useMemo(() => {
    return activeSessions.filter((session) => !session.isCurrent);
  }, [activeSessions]);

  const lang = useLang();

  useHistoryBack(isActive, onReset, onScreenSelect, SettingsScreens.PrivacyActiveSessions);

  function renderCurrentSession(session: ApiSession) {
    return (
      <div className="settings-item">
        <h4 className="settings-item-header mb-4" dir={lang.isRtl ? 'rtl' : undefined}>
          {lang('AuthSessions.CurrentSession')}
        </h4>

        <ListItem narrow inactive className="no-icon">
          <div className="multiline-menu-item" dir="auto">
            <span className="title" dir="auto">{session.appName}</span>
            <span className="subtitle black tight">{getDeviceEnvironment(session)}</span>
            <span className="subtitle">{session.ip} - {getLocation(session)}</span>
          </div>
        </ListItem>

        <ListItem
          className="destructive mb-0 no-icon"
          icon="stop"
          ripple
          narrow
          onClick={openConfirmTerminateAllDialog}
        >
          {lang('TerminateAllSessions')}
        </ListItem>
      </div>
    );
  }

  function renderOtherSessions(sessions: ApiSession[]) {
    return (
      <div className="settings-item">
        <h4 className="settings-item-header mb-4" dir={lang.isRtl ? 'rtl' : undefined}>
          {lang('OtherSessions')}
        </h4>

        {sessions.map(renderSession)}
      </div>
    );
  }

  function renderSession(session: ApiSession) {
    return (
      <ListItem
        key={session.hash}
        ripple
        narrow
        contextActions={[{
          title: 'Terminate',
          icon: 'stop',
          handler: () => {
            handleTerminateSessionClick(session.hash);
          },
        }]}
        className="no-icon"
      >
        <div className="multiline-menu-item full-size" dir="auto">
          <span className="date">{formatPastTimeShort(lang, session.dateActive * 1000)}</span>
          <span className="title">{session.appName}</span>
          <span className="subtitle black tight">{getDeviceEnvironment(session)}</span>
          <span className="subtitle">{session.ip} - {getLocation(session)}</span>
        </div>
      </ListItem>
    );
  }

  return (
    <div className="settings-content custom-scroll">
      {currentSession && renderCurrentSession(currentSession)}
      {otherSessions && renderOtherSessions(otherSessions)}
      {otherSessions && (
        <ConfirmDialog
          isOpen={isConfirmTerminateAllDialogOpen}
          onClose={closeConfirmTerminateAllDialog}
          text="Are you sure you want to terminate all other sessions?"
          confirmLabel="Terminate All Other Sessions"
          confirmHandler={handleTerminateAllSessions}
          confirmIsDestructive
        />
      )}
    </div>
  );
};

function getLocation(session: ApiSession) {
  return [session.region, session.country].filter(Boolean).join(', ');
}

function getDeviceEnvironment(session: ApiSession) {
  return `${session.deviceModel}${session.deviceModel ? ', ' : ''} ${session.platform} ${session.systemVersion}`;
}

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    return {
      activeSessions: global.activeSessions,
    };
  },
)(SettingsPrivacyActiveSessions));
