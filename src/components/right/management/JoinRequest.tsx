import type { FC } from '../../../lib/teact/teact';
import { memo, useCallback } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiUser } from '../../../api/types';

import { getUserFullName } from '../../../global/helpers';
import { selectUser } from '../../../global/selectors';
import { createClassNameBuilder } from '../../../util/buildClassName';
import { formatHumanDate, formatTime, isToday } from '../../../util/dates/dateFormat';
import { getServerTime } from '../../../util/serverTime';

import useOldLang from '../../../hooks/useOldLang';

import Avatar from '../../common/Avatar';
import Button from '../../ui/Button';

import './JoinRequest.scss';

type OwnProps = {
  userId: string;
  about?: string;
  isChannel?: boolean;
  date: number;
  chatId: string;
};

type StateProps = {
  user?: ApiUser;
};

const JoinRequest: FC<OwnProps & StateProps> = ({
  userId,
  chatId,
  about,
  date,
  isChannel,
  user,
}) => {
  const { openChat, hideChatJoinRequest } = getActions();

  const buildClassName = createClassNameBuilder('JoinRequest');
  const lang = useOldLang();

  const fullName = getUserFullName(user);
  const fixedDate = (date - getServerTime()) * 1000 + Date.now();

  const dateString = isToday(new Date(fixedDate))
    ? formatTime(lang, fixedDate) : formatHumanDate(lang, fixedDate, true, false, true);

  const handleUserClick = () => {
    openChat({ id: userId });
  };

  const handleAcceptRequest = useCallback(() => {
    hideChatJoinRequest({ chatId, userId, isApproved: true });
  }, [chatId, hideChatJoinRequest, userId]);

  const handleRejectRequest = useCallback(() => {
    hideChatJoinRequest({ chatId, userId, isApproved: false });
  }, [chatId, hideChatJoinRequest, userId]);

  return (
    <div className={buildClassName('&')}>
      <div className={buildClassName('top')}>
        <div className={buildClassName('user')} onClick={handleUserClick}>
          <Avatar
            key={userId}
            size="medium"
            peer={user}
          />
          <div className={buildClassName('user-info')}>
            <div className={buildClassName('user-name')}>{fullName}</div>
            <div className={buildClassName('user-subtitle')}>{about}</div>
          </div>
        </div>
        <div className={buildClassName('date')}>{dateString}</div>
      </div>
      <div className={buildClassName('buttons')}>
        <Button className={buildClassName('button')} onClick={handleAcceptRequest}>
          {isChannel ? lang('ChannelAddToChannel') : lang('ChannelAddToGroup')}
        </Button>
        <Button className={buildClassName('button')} isText onClick={handleRejectRequest}>
          {lang('DismissRequest')}
        </Button>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { userId }): Complete<StateProps> => {
    const user = selectUser(global, userId);

    return {
      user,
    };
  },
)(JoinRequest));
