import React, {
  memo, useCallback, useEffect, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
import type { ApiWebSession } from '../../../api/types';
import type { AnimationLevel } from '../../../types';

import { formatPastTimeShort } from '../../../util/dateFormat';
import buildClassName from '../../../util/buildClassName';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useHistoryBack from '../../../hooks/useHistoryBack';

import ListItem from '../../ui/ListItem';
import ConfirmDialog from '../../ui/ConfirmDialog';
import SettingsActiveWebsite from './SettingsActiveWebsite';
import Avatar from '../../common/Avatar';
import FullNameTitle from '../../common/FullNameTitle';

import styles from './SettingsActiveWebsites.module.scss';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = {
  byHash: Record<string, ApiWebSession>;
  orderedHashes: string[];
  animationLevel: AnimationLevel;
};

const SettingsActiveWebsites: FC<OwnProps & StateProps> = ({
  isActive,
  byHash,
  orderedHashes,
  animationLevel,
  onReset,
}) => {
  const {
    terminateWebAuthorization,
    terminateAllWebAuthorizations,
  } = getActions();

  const lang = useLang();
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
        <h4 className="settings-item-header mb-4" dir={lang.isRtl ? 'rtl' : undefined}>
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
        // eslint-disable-next-line react/jsx-no-bind
        onClick={() => handleOpenSessionModal(session.hash)}
      >
        <Avatar className={styles.avatar} user={bot} size="tiny" animationLevel={animationLevel} withVideo />
        <div className="multiline-menu-item full-size" dir="auto">
          <span className="date">{formatPastTimeShort(lang, session.dateActive * 1000)}</span>
          {bot && <FullNameTitle className={styles.title} peer={bot} />}
          <span className={buildClassName('subtitle', 'black', 'tight', styles.platform)}>
            {session.domain}, {session.browser}, {session.platform}
          </span>
          <span className="subtitle">{session.ip} {session.region}</span>
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
  (global): StateProps => {
    const { byHash, orderedHashes } = global.activeWebSessions;
    return {
      byHash,
      orderedHashes,
      animationLevel: global.settings.byKey.animationLevel,
    };
  },
)(SettingsActiveWebsites));
