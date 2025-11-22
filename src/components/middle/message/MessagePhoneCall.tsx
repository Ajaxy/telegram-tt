import type { FC } from '../../../lib/teact/teact';
import { memo, useMemo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiMessage } from '../../../api/types';
import type { ApiMessageActionPhoneCall } from '../../../api/types/messageActions';

import { ARE_CALLS_SUPPORTED } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import { formatTime, formatTimeDuration } from '../../../util/dates/dateFormat';
import { getCallMessageKey } from './helpers/messageActions';

import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';

import styles from './MessagePhoneCall.module.scss';

type OwnProps = {
  phoneCall: ApiMessageActionPhoneCall;
  message: ApiMessage;
  chatId: string;
};

const MessagePhoneCall: FC<OwnProps> = ({
  phoneCall,
  message,
  chatId,
}) => {
  const { requestMasterAndRequestCall } = getActions();

  const lang = useOldLang();
  const {
    isVideo, reason, duration,
  } = phoneCall;
  const isOutgoing = message.isOutgoing;
  const isMissed = reason === 'missed';
  const isCancelled = reason === 'busy' || duration === undefined;

  const handleCall = useLastCallback(() => {
    requestMasterAndRequestCall({ isVideo, userId: chatId });
  });

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
        iconName={isVideo ? 'video-outlined' : 'phone'}
      />
      <div className={styles.info}>
        <div className={styles.reason}>{lang(getCallMessageKey(phoneCall, message.isOutgoing))}</div>
        <div className={styles.meta}>
          <Icon
            name="arrow-right"
            className={buildClassName(
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
