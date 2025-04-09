import type { RefObject } from '../../../lib/teact/teact';
import React, { memo, useMemo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiSession } from '../../../api/types';

import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import useResizeObserver from '../../../hooks/useResizeObserver';

import Button from '../../ui/Button';

import styles from './UnconfirmedSession.module.scss';

type OwnProps = {
  sessions: Record<string, ApiSession>;
  onHeightChange: (height: number) => void;
  sessionRef: RefObject<HTMLDivElement | null>;
};

const UnconfirmedSession = ({ sessionRef, sessions, onHeightChange } : OwnProps) => {
  const { changeSessionSettings, terminateAuthorization, showNotification } = getActions();
  const lang = useOldLang();

  useResizeObserver(sessionRef, (entry) => {
    const height = entry.borderBoxSize?.[0]?.blockSize || entry.contentRect.height;
    onHeightChange(height);
  });

  const firstUnconfirmed = useMemo(() => {
    return Object.values(sessions).sort((a, b) => b.dateCreated - a.dateCreated)
      .find((session) => session.isUnconfirmed)!;
  }, [sessions]);

  const locationString = useMemo(() => {
    return [firstUnconfirmed.deviceModel, firstUnconfirmed.region, firstUnconfirmed.country].filter(Boolean).join(', ');
  }, [firstUnconfirmed]);

  const handleAccept = useLastCallback(() => {
    changeSessionSettings({
      hash: firstUnconfirmed.hash,
      isConfirmed: true,
    });
  });

  const handleReject = useLastCallback(() => {
    terminateAuthorization({ hash: firstUnconfirmed.hash });
    showNotification({
      title: lang('UnconfirmedAuthDeniedTitle', 1),
      message: lang('UnconfirmedAuthDeniedMessageSingle', locationString),
    });
  });

  return (
    <div className={styles.root} ref={sessionRef}>
      <h2 className={styles.title}>{lang('UnconfirmedAuthTitle')}</h2>
      <p className={styles.info}>
        {lang('UnconfirmedAuthSingle', locationString)}
      </p>
      <div className={styles.buttons}>
        <Button fluid isText size="smaller" className={styles.button} onClick={handleAccept}>
          {lang('UnconfirmedAuthConfirm')}
        </Button>
        <Button fluid isText size="smaller" color="danger" onClick={handleReject} className={styles.button}>
          {lang('UnconfirmedAuthDeny')}
        </Button>
      </div>
    </div>
  );
};

export default memo(UnconfirmedSession);
