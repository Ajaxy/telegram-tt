import { memo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { ApiMessage } from '../../api/types';
import { ApiMediaFormat } from '../../api/types';

import { getMessageMediaHash } from '../../global/helpers';
import { selectChatMessage } from '../../global/selectors';

import useMedia from '../../hooks/useMedia';

import styles from './CalendarDayThumb.module.scss';

type OwnProps = {
  chatId: string;
  messageId: number;
};

type StateProps = {
  message?: ApiMessage;
};

const EMPTY_STATEFUL_MEDIA = {};

const CalendarDayThumb = ({ message }: OwnProps & StateProps) => {
  const mediaHash = message ? getMessageMediaHash(message, EMPTY_STATEFUL_MEDIA, 'pictogram') : undefined;
  const blobUrl = useMedia(mediaHash, !mediaHash, ApiMediaFormat.BlobUrl);

  if (!blobUrl) return undefined;

  return <img src={blobUrl} className={styles.root} alt="" draggable={false} />;
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId, messageId }): Complete<StateProps> => {
    return { message: selectChatMessage(global, chatId, messageId) };
  },
)(CalendarDayThumb));
