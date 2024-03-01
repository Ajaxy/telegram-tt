import React, { memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { getUserFirstOrLastName } from '../../global/helpers';
import { selectUser } from '../../global/selectors';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Link from '../ui/Link';

type OwnProps = {
  userId: string;
};

type StateProps = {
  userName?: string;
};

function PremiumRequiredPlaceholder({ userName }: StateProps) {
  const lang = useLang();
  const { openPremiumModal } = getActions();

  const handleOpenPremiumModal = useLastCallback(() => openPremiumModal());

  return (
    <div>
      <div>{lang('Chat.MessagingRestrictedPlaceholder', userName)}</div>
      <Link isPrimary onClick={handleOpenPremiumModal}>{lang('Chat.MessagingRestrictedPlaceholderAction')}</Link>
    </div>
  );
}

export default memo(withGlobal<OwnProps>(
  (global, { userId }): StateProps => {
    const user = selectUser(global, userId);

    return {
      userName: getUserFirstOrLastName(user),
    };
  },
)(PremiumRequiredPlaceholder));
