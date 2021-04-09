import React, { FC, useEffect, memo } from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { ApiUser } from '../../api/types';
import { GlobalActions, GlobalState } from '../../global/types';

import { selectUser } from '../../modules/selectors';
import { formatPhoneNumberWithCode } from '../../util/phoneNumber';
import renderText from '../common/helpers/renderText';
import { pick } from '../../util/iteratees';
import useLang from '../../hooks/useLang';

type OwnProps = {
  userId: number;
  forceShowSelf?: boolean;
};

type StateProps = {
  user?: ApiUser;
} & Pick<GlobalState, 'lastSyncTime'>;

type DispatchProps = Pick<GlobalActions, 'loadFullUser'>;

const UserExtra: FC<OwnProps & StateProps & DispatchProps> = ({
  lastSyncTime, user, forceShowSelf, loadFullUser,
}) => {
  const {
    id: userId,
    fullInfo,
    username,
    phoneNumber,
    isSelf,
  } = user || {};

  useEffect(() => {
    if (lastSyncTime) {
      loadFullUser({ userId });
    }
  }, [loadFullUser, userId, lastSyncTime]);

  const lang = useLang();

  if (!user || (isSelf && !forceShowSelf)) {
    return undefined;
  }

  const bio = fullInfo && fullInfo.bio;
  const formattedNumber = phoneNumber && formatPhoneNumberWithCode(phoneNumber);

  return (
    <div className="ChatExtra">
      {bio && !!bio.length && (
        <div className="item">
          <i className="icon-info" />
          <div>
            <p className="title">{renderText(bio, ['br', 'links'])}</p>
            <p className="subtitle">{lang('UserBio')}</p>
          </div>
        </div>
      )}
      {username && !!username.length && (
        <div className="item">
          <i className="icon-mention" />
          <div>
            <p className="title">{renderText(username)}</p>
            <p className="subtitle">{lang('Username')}</p>
          </div>
        </div>
      )}
      {formattedNumber && !!formattedNumber.length && (
        <div className="item">
          <i className="icon-phone" />
          <div>
            <p className="title">{formattedNumber}</p>
            <p className="subtitle">{lang('Phone')}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { userId }): StateProps => {
    const { lastSyncTime } = global;
    const user = selectUser(global, userId);

    return { lastSyncTime, user };
  },
  (setGlobal, actions): DispatchProps => pick(actions, ['loadFullUser']),
)(UserExtra));
