import type { FC } from '../../../lib/teact/teact';
import React, { memo, useMemo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiMessage, PhoneCallAction } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import { formatTime, formatTimeDuration } from '../../../util/date/dateFormat';
import { ARE_CALLS_SUPPORTED } from '../../../util/windowEnvironment';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Button from '../../ui/Button';

import styles from './MessagePhoneCall.module.scss';

type OwnProps = {
  phoneCall: PhoneCallAction;
  message: ApiMessage;
  chatId: string;
};

const MessagePhoneCall: FC<OwnProps> = ({
  phoneCall,
  message,
  chatId,
}) => {
  const { requestMasterAndRequestCall } = getActions();

  const lang = useLang();
  const {
    isOutgoing, isVideo, reason, duration,
  } = phoneCall;
  const isMissed = reason === 'missed';
  const isCancelled = reason === 'busy' || duration === undefined;

  const handleCall = useLastCallback(() => {
    requestMasterAndRequestCall({ isVideo, userId: chatId });
  });

  const reasonText = useMemo(() => {
    if (isVideo) {
      if (isMissed) return isOutgoing ? 'CallMessageVideoOutgoingMissed' : 'CallMessageVideoIncomingMissed';
      if (isCancelled) return 'CallMessageVideoIncomingDeclined';

      return isOutgoing ? 'CallMessageVideoOutgoing' : 'CallMessageVideoIncoming';
    } else {
      if (isMissed) return isOutgoing ? 'CallMessageOutgoingMissed' : 'CallMessageIncomingMissed';
      if (isCancelled) return 'CallMessageIncomingDeclined';

      return isOutgoing ? 'CallMessageOutgoing' : 'CallMessageIncoming';
    }
  }, [isCancelled, isMissed, isOutgoing, isVideo]);

  const formattedDuration = useMemo(() => {
    return phoneCall.duration ? formatTimeDuration(lang, phoneCall.duration) : undefined;
  }, [lang, phoneCall.duration]);

  const timeFormatted = formatTime(lang, message.date * 1000);
  return (
    <div className={styles.root}>
      <Button
        size="smaller"
        color="translucent"
        round
        ripple
        onClick={handleCall}
        className={styles.button}
        disabled={!ARE_CALLS_SUPPORTED}
        ariaLabel={lang(isOutgoing ? 'CallAgain' : 'CallBack')}
      >
        <i className={buildClassName('icon', isVideo ? 'icon-video-outlined' : 'icon-phone')} />
      </Button>
      <div className={styles.info}>
        <div className={styles.reason}>{lang(reasonText)}</div>
        <div className={styles.meta}>
          <i
            className={buildClassName(
              'icon',
              'icon-arrow-right',
              styles.arrow,
              isMissed && styles.missed,
              isCancelled && styles.canceled,
              !isOutgoing && styles.incoming,
            )}
          />
          <span className={styles.duration}>
            {formattedDuration ? lang('CallMessageWithDuration', [timeFormatted, formattedDuration]) : timeFormatted}
          </span>
        </div>
      </div>
    </div>
  );
};

export default memo(MessagePhoneCall);
