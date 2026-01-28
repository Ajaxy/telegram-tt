import { memo } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';
import { selectTelebizPendingOrganization, selectTelebizUser } from '../../../global';

import type { OrganizationMember, TelebizUser } from '../../../services/types';

import { ORGANIZATION_MANAGER_ROLES } from '../../../config/constants';

import Member from './Member';

import styles from './TelebizOrganizations.module.scss';

interface OwnProps {
  members: Partial<OrganizationMember>[];
}

interface StateProps {
  user: TelebizUser | undefined;
  isManager: boolean;
}

const MembersList = ({ members, user, isManager }:
  OwnProps & StateProps) => {
  return (
    <div className={styles.membersList}>
      {members.map((member) => (
        <Member
          key={member.telegram_id}
          member={member}
          isDisabled={user?.telegram_id === member.telegram_id || !isManager}
        />
      ))}
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    const user = selectTelebizUser(global);
    const pendingOrg = selectTelebizPendingOrganization(global);
    const currentUserMember = pendingOrg?.members?.find(
      (m: Partial<OrganizationMember>) => m.telegram_id === user?.telegram_id,
    );
    const isManager = Boolean(
      currentUserMember?.role_name && ORGANIZATION_MANAGER_ROLES.includes(currentUserMember.role_name),
    );

    return {
      user,
      isManager,
    };
  },
)(MembersList));
