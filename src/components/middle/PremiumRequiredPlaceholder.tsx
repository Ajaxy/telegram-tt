import { memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiUser } from '../../api/types';

import { getUserFirstOrLastName } from '../../global/helpers';
import { selectUser } from '../../global/selectors';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Link from '../ui/Link';

type OwnProps = {
  userId: string;
};

type StateProps = {
  user?: ApiUser;
};

function PremiumRequiredPlaceholder({ user }: StateProps) {
  const { openPremiumModal } = getActions();
  const lang = useLang();
  const userName = getUserFirstOrLastName(lang, user);

  const handleOpenPremiumModal = useLastCallback(() => openPremiumModal());

  return (
    <div>
      <div>{lang('ChatMessagingRestrictedPlaceholder', { user: userName })}</div>
      <Link isPrimary onClick={handleOpenPremiumModal}>{lang('ChatMessagingRestrictedPlaceholderAction')}</Link>
    </div>
  );
}

export default memo(withGlobal<OwnProps>(
  (global, { userId }): Complete<StateProps> => {
    const user = selectUser(global, userId);

    return {
      user,
    };
  },
)(PremiumRequiredPlaceholder));
