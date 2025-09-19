import type { FC } from '../../../lib/teact/teact';
import {
  memo, useCallback, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiSession } from '../../../api/types';
import type { GlobalState } from '../../../global/types';

import { formatPastTimeShort } from '../../../util/dates/dateFormat';
import getSessionIcon from './helpers/getSessionIcon';

import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useOldLang from '../../../hooks/useOldLang';

import ConfirmDialog from '../../ui/ConfirmDialog';
import ListItem from '../../ui/ListItem';
import RadioGroup from '../../ui/RadioGroup';
import SettingsActiveSession from './SettingsActiveSession';

import './SettingsActiveSessions.scss';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = GlobalState['activeSessions'];

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

  const oldLang = useOldLang();
  const lang = useLang();
  const [isConfirmTerminateAllDialogOpen, openConfirmTerminateAllDialog, closeConfirmTerminateAllDialog] = useFlag();
  const [openedSessionHash, setOpenedSessionHash] = useState<string | undefined>();
  const [isModalOpen, openModal, closeModal] = useFlag();

  const autoTerminateValue = useMemo(() => {
    // https://github.com/DrKLO/Telegram/blob/96dce2c9aabc33b87db61d830aa087b6b03fe397/TMessagesProj/src/main/java/org/telegram/ui/SessionsActivity.java#L195
    if (ttlDays === undefined) {
      return undefined;
    }

    if (ttlDays <= 7) {
      return '7';
    }

    if (ttlDays <= 30) {
      return '30';
    }

    if (ttlDays <= 93) {
      return '90';
    }

    if (ttlDays <= 183) {
      return '183';
    }

    if (ttlDays > 183) {
      return '365';
    }

    return undefined;
  }, [ttlDays]);

  const AUTO_TERMINATE_OPTIONS = useMemo(() => {
    const options = [{
      label: lang('Weeks', { count: 1 }, { pluralValue: 1 }),
      value: '7',
    }, {
      label: lang('Months', { count: 1 }, { pluralValue: 1 }),
      value: '30',
    }, {
      label: lang('Months', { count: 3 }, { pluralValue: 3 }),
      value: '90',
    }, {
      label: lang('Months', { count: 6 }, { pluralValue: 6 }),
      value: '183',
    }];
    if (ttlDays && ttlDays >= 365) {
      options.push({
        label: lang('Years', { count: 1 }, { pluralValue: 1 }),
        value: '365',
      });
    }
    return options;
  }, [lang, ttlDays]);

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
        <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>
          {lang('AuthSessionsCurrentSession')}
        </h4>

        <ListItem narrow inactive icon={`device-${getSessionIcon(session)}`} iconClassName="icon-device">
          <div className="multiline-item full-size" dir="auto">
            <span className="title" dir="auto">{session.deviceModel}</span>
            <span className="subtitle black tight">
              {session.appName}
              {' '}
              {session.appVersion}
              ,
              {' '}
              {session.platform}
              {' '}
              {session.systemVersion}
            </span>
            <span className="subtitle">
              {session.ip}
              {' '}
              -
              {' '}
              {getLocation(session)}
            </span>
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
        <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>
          {lang('OtherSessions')}
        </h4>

        {sessionHashes.map(renderSession)}
      </div>
    );
  }

  function renderAutoTerminate() {
    return (
      <div className="settings-item">
        <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>
          {lang('TerminateOldSessionHeader')}
        </h4>

        <p className="settings-item-description-larger">{lang('IfInactiveFor')}</p>
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
          title: lang('SessionTerminate'),
          icon: 'stop',
          destructive: true,
          handler: () => {
            handleTerminateSessionClick(session.hash);
          },
        }]}
        icon={`device-${getSessionIcon(session)}`}
        iconClassName="icon-device"
        onClick={() => { handleOpenSessionModal(session.hash); }}
      >
        <div className="multiline-item full-size" dir="auto">
          <span className="date">{formatPastTimeShort(oldLang, session.dateActive * 1000)}</span>
          <span className="title">{session.deviceModel}</span>
          <span className="subtitle black tight">
            {session.appName}
            {' '}
            {session.appVersion}
            ,
            {' '}
            {session.platform}
            {' '}
            {session.systemVersion}
          </span>
          <span className="subtitle">
            {session.ip}
            {' '}
            {getLocation(session)}
          </span>
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
          areButtonsInColumn
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
  (global): Complete<StateProps> => global.activeSessions as Complete<StateProps>,
)(SettingsActiveSessions));
