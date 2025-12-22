import { memo, useMemo } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiSession } from '../../../../api/types';

import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useHeaderPane, { type PaneState } from '../../../middle/hooks/useHeaderPane';

import Button from '../../../ui/Button';

import styles from './UnconfirmedSessionPane.module.scss';

type OwnProps = {
  unconfirmedSession: ApiSession | undefined;
  onPaneStateChange: (state: PaneState) => void;
};

const UnconfirmedSessionPane = ({
  unconfirmedSession,
  onPaneStateChange,
}: OwnProps) => {
  const { changeSessionSettings, terminateAuthorization, showNotification } = getActions();
  const lang = useLang();

  const isOpen = Boolean(unconfirmedSession);
  const renderingSession = useCurrentOrPrev(unconfirmedSession);

  const { ref, shouldRender } = useHeaderPane({
    isOpen,
    withResizeObserver: true,
    onStateChange: onPaneStateChange,
  });

  const locationString = useMemo(() => {
    if (!renderingSession) return '';
    if (!renderingSession.region) {
      return lang('UnconfirmedAuthLocationCountry', {
        deviceModel: renderingSession.deviceModel,
        country: renderingSession.country,
      });
    }

    return lang('UnconfirmedAuthLocationRegion', {
      deviceModel: renderingSession.deviceModel,
      region: renderingSession.region,
      country: renderingSession.country,
    });
  }, [renderingSession, lang]);

  const handleAccept = useLastCallback(() => {
    if (!renderingSession) return;
    changeSessionSettings({
      hash: renderingSession.hash,
      isConfirmed: true,
    });
  });

  const handleReject = useLastCallback(() => {
    if (!renderingSession) return;
    terminateAuthorization({ hash: renderingSession.hash });
    showNotification({
      title: lang('UnconfirmedAuthDeniedTitle'),
      message: lang('UnconfirmedAuthDeniedMessage', { location: locationString }),
    });
  });

  if (!shouldRender || !renderingSession) return undefined;

  return (
    <div
      className={styles.root}
      ref={ref}
    >
      <h2 className={styles.title}>{lang('UnconfirmedAuthTitle')}</h2>
      <p className={styles.info}>
        {lang('UnconfirmedAuthSingle', { location: locationString })}
      </p>
      <div className={styles.buttons}>
        <Button fluid isText className={styles.button} onClick={handleAccept}>
          {lang('UnconfirmedAuthConfirm')}
        </Button>
        <Button fluid isText color="danger" onClick={handleReject} className={styles.button}>
          {lang('UnconfirmedAuthDeny')}
        </Button>
      </div>
    </div>
  );
};

export default memo(UnconfirmedSessionPane);
