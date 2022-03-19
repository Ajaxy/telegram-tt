import React, { FC, memo, useCallback } from '../../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../../modules';

import { ApiUser } from '../../../api/types';

import useLang from '../../../hooks/useLang';
import { getUserFullName } from '../../../modules/helpers';
import { selectUser } from '../../../modules/selectors';
import { formatHumanDate, formatTime, isToday } from '../../../util/dateFormat';
import { getServerTime } from '../../../util/serverTime';
import { createClassNameBuilder } from '../../../util/buildClassName';

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
  isSavedMessages?: boolean;
  serverTimeOffset: number;
};

const JoinRequest: FC<OwnProps & StateProps> = ({
  userId,
  about,
  date,
  isChannel,
  user,
  serverTimeOffset,
  chatId,
}) => {
  const { openChat, hideChatJoinRequest } = getDispatch();

  const buildClassName = createClassNameBuilder('JoinRequest');
  const lang = useLang();

  const fullName = getUserFullName(user);
  const fixedDate = (date - getServerTime(serverTimeOffset)) * 1000 + Date.now();

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
            user={user}
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
  (global, { userId }): StateProps => {
    const user = selectUser(global, userId);

    return {
      user,
      serverTimeOffset: global.serverTimeOffset,
    };
  },
)(JoinRequest));
