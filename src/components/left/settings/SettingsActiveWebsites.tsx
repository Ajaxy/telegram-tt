import type { FC } from '../../../lib/teact/teact';
import {
  memo, useCallback, useEffect, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiWebSession } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import { formatPastTimeShort } from '../../../util/dates/dateFormat';

import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useOldLang from '../../../hooks/useOldLang';

import Avatar from '../../common/Avatar';
import FullNameTitle from '../../common/FullNameTitle';
import ConfirmDialog from '../../ui/ConfirmDialog';
import ListItem from '../../ui/ListItem';
import SettingsActiveWebsite from './SettingsActiveWebsite';

import styles from './SettingsActiveWebsites.module.scss';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = {
  byHash: Record<string, ApiWebSession>;
  orderedHashes: string[];
};

const SettingsActiveWebsites: FC<OwnProps & StateProps> = ({
  isActive,
  byHash,
  orderedHashes,
  onReset,
}) => {
  const {
    terminateWebAuthorization,
    terminateAllWebAuthorizations,
  } = getActions();

  const lang = useOldLang();
  const [isConfirmTerminateAllDialogOpen, openConfirmTerminateAllDialog, closeConfirmTerminateAllDialog] = useFlag();
  const [openedWebsiteHash, setOpenedWebsiteHash] = useState<string | undefined>();
  const [isModalOpen, openModal, closeModal] = useFlag();

  const handleTerminateAuthClick = useCallback((hash: string) => {
    terminateWebAuthorization({ hash });
  }, [terminateWebAuthorization]);

  const handleTerminateAllAuth = useCallback(() => {
    closeConfirmTerminateAllDialog();
    terminateAllWebAuthorizations();
  }, [closeConfirmTerminateAllDialog, terminateAllWebAuthorizations]);

  const handleOpenSessionModal = useCallback((hash: string) => {
    setOpenedWebsiteHash(hash);
    openModal();
  }, [openModal]);

  const handleCloseWebsiteModal = useCallback(() => {
    setOpenedWebsiteHash(undefined);
    closeModal();
  }, [closeModal]);

  // Close when empty
  useEffect(() => {
    if (!orderedHashes.length) {
      onReset();
    }
  }, [onReset, orderedHashes]);

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  function renderSessions(sessionHashes: string[]) {
    return (
      <div className="settings-item">
        <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>
          {lang('WebSessionsTitle')}
        </h4>

        {sessionHashes.map(renderSession)}
      </div>
    );
  }

  function renderSession(sessionHash: string) {
    const session = byHash[sessionHash];
    const bot = getGlobal().users.byId[session.botId];

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
            handleTerminateAuthClick(session.hash);
          },
        }]}

        onClick={() => handleOpenSessionModal(session.hash)}
      >
        <Avatar className={styles.avatar} peer={bot} size="tiny" />
        <div className="multiline-item full-size" dir="auto">
          <span className="date">{formatPastTimeShort(lang, session.dateActive * 1000)}</span>
          {bot && <FullNameTitle className={styles.title} peer={bot} />}
          <span className={buildClassName('subtitle', 'black', 'tight', styles.platform)}>
            {session.domain}
            ,
            {session.browser}
            ,
            {session.platform}
          </span>
          <span className={buildClassName('subtitle', styles.subtitle)}>
            {session.ip}
            {' '}
            {session.region}
          </span>
        </div>
      </ListItem>
    );
  }

  if (!orderedHashes.length) return undefined;

  return (
    <div className="settings-content custom-scroll">
      <div className="settings-item">
        <ListItem
          className="destructive mb-0 no-icon"
          icon="stop"
          ripple
          narrow
          onClick={openConfirmTerminateAllDialog}
        >
          {lang('AuthSessions.LogOutApplications')}
        </ListItem>
        <p className={buildClassName('settings-item-description', styles.clearHelp)}>
          {lang('ClearOtherWebSessionsHelp')}
        </p>
      </div>
      {renderSessions(orderedHashes)}
      <ConfirmDialog
        isOpen={isConfirmTerminateAllDialogOpen}
        onClose={closeConfirmTerminateAllDialog}
        title={lang('AuthSessions.LogOutApplications')}
        text={lang('AreYouSureWebSessions')}
        confirmHandler={handleTerminateAllAuth}
        confirmIsDestructive
      />
      <SettingsActiveWebsite isOpen={isModalOpen} hash={openedWebsiteHash} onClose={handleCloseWebsiteModal} />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const { byHash, orderedHashes } = global.activeWebSessions;
    return {
      byHash,
      orderedHashes,
    };
  },
)(SettingsActiveWebsites));
