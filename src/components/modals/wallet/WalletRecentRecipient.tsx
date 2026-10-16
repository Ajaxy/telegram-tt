import { memo } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiUser, ApiUserStatus } from '../../../api/types';

import { getMainUsername, getUserFullName, getUserStatus } from '../../../global/helpers';
import { selectUser, selectUserStatus } from '../../../global/selectors';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Avatar from '../../common/Avatar';
import Control, { ControlBefore, ControlDescription, ControlLabel } from '@gili/layout/Control';
import Interactive from '@gili/layout/Interactive';

type OwnProps = {
  userId: string;
  // Found by the typed address, so the row explains the link instead of the status
  isLinkedAddress?: boolean;
  // The search can bring a stranger with a familiar name, whom only the username tells apart
  withUsername?: boolean;
  className?: string;
  onSelect: (userId: string) => void;
};

type StateProps = {
  user?: ApiUser;
  userStatus?: ApiUserStatus;
};

const WalletRecentRecipient = ({
  userId, user, userStatus, isLinkedAddress, withUsername, className, onSelect,
}: OwnProps & StateProps) => {
  const lang = useLang();

  const handleClick = useLastCallback(() => {
    onSelect(userId);
  });

  if (!user) return undefined;

  const username = withUsername ? getMainUsername(user) : undefined;

  return (
    <Interactive className={className} clickable ripple onClick={handleClick}>
      <Control>
        <ControlBefore>
          <Avatar peer={user} size="medium" />
        </ControlBefore>
        <ControlLabel>{getUserFullName(lang, user)}</ControlLabel>
        <ControlDescription>
          {isLinkedAddress
            ? lang('WalletSendAddressLinked', { name: getUserFullName(lang, user) }, {
              withNodes: true, withMarkdown: true,
            })
            : username ? `@${username}` : getUserStatus(lang, user, userStatus)}
        </ControlDescription>
      </Control>
    </Interactive>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { userId }): Complete<StateProps> => {
    return {
      user: selectUser(global, userId),
      userStatus: selectUserStatus(global, userId),
    };
  },
)(WalletRecentRecipient));
