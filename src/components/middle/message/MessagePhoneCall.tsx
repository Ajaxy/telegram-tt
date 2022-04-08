import React, {
  FC, memo, useCallback, useMemo,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import { ApiMessage, PhoneCallAction } from '../../../api/types';

import useLang from '../../../hooks/useLang';
import buildClassName from '../../../util/buildClassName';
import { formatTimeDuration, formatTime } from '../../../util/dateFormat';
import { ARE_CALLS_SUPPORTED } from '../../../util/environment';

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
  const { requestCall } = getActions();

  const lang = useLang();
  const { isOutgoing, isVideo, reason } = phoneCall;
  const isMissed = reason === 'missed';
  const isCancelled = reason === 'busy' && !isOutgoing;

  const handleCall = useCallback(() => {
    requestCall({ isVideo, userId: chatId });
  }, [chatId, isVideo, requestCall]);

  const reasonText = useMemo(() => {
    if (isVideo) {
      if (isCancelled) return 'CallMessageVideoIncomingDeclined';
      if (isMissed) return isOutgoing ? 'CallMessageVideoOutgoingMissed' : 'CallMessageVideoIncomingMissed';

      return isOutgoing ? 'CallMessageVideoOutgoing' : 'CallMessageVideoIncoming';
    } else {
      if (isCancelled) return 'CallMessageIncomingDeclined';
      if (isMissed) return isOutgoing ? 'CallMessageOutgoingMissed' : 'CallMessageIncomingMissed';

      return isOutgoing ? 'CallMessageOutgoing' : 'CallMessageIncoming';
    }
  }, [isCancelled, isMissed, isOutgoing, isVideo]);

  const duration = useMemo(() => {
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
        <i className={isVideo ? 'icon-video-outlined' : 'icon-phone'} />
      </Button>
      <div className={styles.info}>
        <div className={styles.reason}>{lang(reasonText)}</div>
        <div className={styles.meta}>
          <i
            className={buildClassName(
              'icon-arrow-right', styles.arrow, isMissed && styles.missed, !isOutgoing && styles.incoming,
            )}
          />
          <span className={styles.duration}>
            {duration ? lang('CallMessageWithDuration', [timeFormatted, duration]) : timeFormatted}
          </span>
        </div>
      </div>
    </div>
  );
};

export default memo(MessagePhoneCall);
