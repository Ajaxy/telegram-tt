import {
  memo, useCallback, useEffect, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiWebSession } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import { formatCompactTimestamp, secondsToDate } from '../../../util/localization/dateFormat';

import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';

import Avatar from '../../common/Avatar';
import FullNameTitle from '../../common/FullNameTitle';
import Island, { IslandDescription, IslandTitle } from '../../gili/layout/Island';
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

const SettingsActiveWebsites = ({
  isActive,
  byHash,
  orderedHashes,
  onReset,
}: OwnProps & StateProps) => {
  const { terminateWebAuthorization, openSettingsConfirmation } = getActions();

  const lang = useLang();
  const [openedWebsiteHash, setOpenedWebsiteHash] = useState<string | undefined>();
  const [isModalOpen, openModal, closeModal] = useFlag();

  const handleTerminateAuthClick = useCallback((hash: string) => {
    terminateWebAuthorization({ hash });
  }, [terminateWebAuthorization]);

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
    if (isActive && !orderedHashes.length) {
      onReset();
    }
  }, [isActive, onReset, orderedHashes]);

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  function renderSessions(sessionHashes: string[]) {
    return (
      <>
        <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>
          {lang('WebSessionsTitle')}
        </IslandTitle>
        <Island>
          {sessionHashes.map(renderSession)}
        </Island>
      </>
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
          <div className="title title-with-date">
            {bot && <FullNameTitle className={styles.title} peer={bot} />}
            <span className="date">{formatCompactTimestamp(lang, secondsToDate(session.dateActive))}</span>
          </div>
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
      <Island>
        <ListItem
          className="destructive mb-0 no-icon"
          icon="stop"
          ripple
          narrow
          onClick={() => openSettingsConfirmation({ confirmation: 'terminateAllWebSessions' })}
        >
          {lang('AuthSessionsLogOutApplications')}
        </ListItem>
      </Island>
      <IslandDescription className={styles.clearHelp}>
        {lang('ClearOtherWebSessionsHelp')}
      </IslandDescription>
      {renderSessions(orderedHashes)}
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
