/* eslint-disable react/jsx-no-bind */
import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiSession } from '../../../api/types';

import { formatPastTimeShort } from '../../../util/dateFormat';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useHistoryBack from '../../../hooks/useHistoryBack';
import getSessionIcon from './helpers/getSessionIcon';

import ListItem from '../../ui/ListItem';
import ConfirmDialog from '../../ui/ConfirmDialog';
import SettingsActiveSession from './SettingsActiveSession';

import './SettingsActiveSessions.scss';
import RadioGroup from '../../ui/RadioGroup';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = {
  byHash: Record<string, ApiSession>;
  orderedHashes: string[];
  ttlDays?: number;
};

const SettingsActiveSessions: FC<OwnProps & StateProps> = ({
  isActive,
  onReset,
  byHash,
  orderedHashes,
  ttlDays,
}) => {
  const {
    terminateAuthorization,
    terminateAllAuthorizations,
    changeSessionTtl,
  } = getActions();

  const lang = useLang();
  const [isConfirmTerminateAllDialogOpen, openConfirmTerminateAllDialog, closeConfirmTerminateAllDialog] = useFlag();
  const [openedSessionHash, setOpenedSessionHash] = useState<string | undefined>();
  const [isModalOpen, openModal, closeModal] = useFlag();

  const autoTerminateValue = useMemo(() => {
    if (ttlDays === undefined) {
      return undefined;
    }
    if (ttlDays <= 7) {
      return '7';
    }
    if (ttlDays <= 30) {
      return '30';
    }
    if (ttlDays <= 90) {
      return '90';
    }
    if (ttlDays <= 180) {
      return '180';
    }

    return undefined;
  }, [ttlDays]);

  const AUTO_TERMINATE_OPTIONS = useMemo(() => [{
    label: lang('Weeks', 1, 'i'),
    value: '7',
  }, {
    label: lang('Months', 1, 'i'),
    value: '30',
  }, {
    label: lang('Months', 3, 'i'),
    value: '90',
  }, {
    label: lang('Months', 6, 'i'),
    value: '180',
  }], [lang]);

  const handleTerminateSessionClick = useCallback((hash: string) => {
    terminateAuthorization({ hash });
  }, [terminateAuthorization]);

  const handleTerminateAllSessions = useCallback(() => {
    closeConfirmTerminateAllDialog();
    terminateAllAuthorizations();
  }, [closeConfirmTerminateAllDialog, terminateAllAuthorizations]);

  const handleOpenSessionModal = useCallback((hash: string) => {
    setOpenedSessionHash(hash);
    openModal();
  }, [openModal]);

  const handleCloseSessionModal = useCallback(() => {
    setOpenedSessionHash(undefined);
    closeModal();
  }, [closeModal]);

  const handleChangeSessionTtl = useCallback((value: string) => {
    changeSessionTtl({ days: Number(value) });
  }, [changeSessionTtl]);

  const currentSession = useMemo(() => {
    const currentSessionHash = orderedHashes.find((hash) => byHash[hash].isCurrent);

    return currentSessionHash ? byHash[currentSessionHash] : undefined;
  }, [byHash, orderedHashes]);

  const otherSessionHashes = useMemo(() => {
    return orderedHashes.filter((hash) => !byHash[hash].isCurrent);
  }, [byHash, orderedHashes]);
  const hasOtherSessions = Boolean(otherSessionHashes.length);

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  function renderCurrentSession(session: ApiSession) {
    return (
      <div className="settings-item">
        <h4 className="settings-item-header mb-4" dir={lang.isRtl ? 'rtl' : undefined}>
          {lang('AuthSessions.CurrentSession')}
        </h4>

        <ListItem narrow inactive icon={`device-${getSessionIcon(session)} icon-device`}>
          <div className="multiline-menu-item" dir="auto">
            <span className="title" dir="auto">{session.deviceModel}</span>
            <span className="subtitle black tight">
              {session.appName} {session.appVersion}, {session.platform} {session.systemVersion}
            </span>
            <span className="subtitle">{session.ip} - {getLocation(session)}</span>
          </div>
        </ListItem>

        {hasOtherSessions && (
          <ListItem
            className="destructive mb-0 no-icon"
            icon="stop"
            ripple
            narrow
            onClick={openConfirmTerminateAllDialog}
          >
            {lang('TerminateAllSessions')}
          </ListItem>
        )}
      </div>
    );
  }

  function renderOtherSessions(sessionHashes: string[]) {
    return (
      <div className="settings-item">
        <h4 className="settings-item-header mb-4" dir={lang.isRtl ? 'rtl' : undefined}>
          {lang('OtherSessions')}
        </h4>

        {sessionHashes.map(renderSession)}
      </div>
    );
  }

  function renderAutoTerminate() {
    return (
      <div className="settings-item">
        <h4 className="settings-item-header mb-4" dir={lang.isRtl ? 'rtl' : undefined}>
          {lang('TerminateOldSessionHeader')}
        </h4>

        <p>{lang('IfInactiveFor')}</p>
        <RadioGroup
          name="session_ttl"
          options={AUTO_TERMINATE_OPTIONS}
          selected={autoTerminateValue}
          onChange={handleChangeSessionTtl}
        />
      </div>
    );
  }

  function renderSession(sessionHash: string) {
    const session = byHash[sessionHash];

    return (
      <ListItem
        key={session.hash}
        ripple
        narrow
        contextActions={[{
          title: 'Terminate',
          icon: 'stop',
          destructive: true,
          handler: () => {
            handleTerminateSessionClick(session.hash);
          },
        }]}
        icon={`device-${getSessionIcon(session)} icon-device`}
        onClick={() => { handleOpenSessionModal(session.hash); }}
      >
        <div className="multiline-menu-item full-size" dir="auto">
          <span className="date">{formatPastTimeShort(lang, session.dateActive * 1000)}</span>
          <span className="title">{session.deviceModel}</span>
          <span className="subtitle black tight">
            {session.appName} {session.appVersion}, {session.platform} {session.systemVersion}
          </span>
          <span className="subtitle">{session.ip} {getLocation(session)}</span>
        </div>
      </ListItem>
    );
  }

  return (
    <div className="settings-content custom-scroll SettingsActiveSessions">
      {currentSession && renderCurrentSession(currentSession)}
      {hasOtherSessions && renderOtherSessions(otherSessionHashes)}
      {renderAutoTerminate()}
      {hasOtherSessions && (
        <ConfirmDialog
          isOpen={isConfirmTerminateAllDialogOpen}
          onClose={closeConfirmTerminateAllDialog}
          text={lang('AreYouSureSessions')}
          confirmLabel={lang('TerminateAllSessions')}
          confirmHandler={handleTerminateAllSessions}
          confirmIsDestructive
        />
      )}
      <SettingsActiveSession isOpen={isModalOpen} hash={openedSessionHash} onClose={handleCloseSessionModal} />
    </div>
  );
};

function getLocation(session: ApiSession) {
  return [session.region, session.country].filter(Boolean).join(', ');
}

export default memo(withGlobal<OwnProps>(
  (global): StateProps => global.activeSessions,
)(SettingsActiveSessions));
