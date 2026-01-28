import { memo, useEffect, useMemo } from '../../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../../global';
import { selectTelebizPendingOrganization, selectTelebizRoles, selectTelebizUser } from '../../../global';

import type { ApiPeer } from '../../../../api/types';
import type { OrganizationMember, Role } from '../../../services/types';

import { ORGANIZATION_OWNER_ROLE } from '../../../config/constants';
import { selectPeer } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';

import useLastCallback from '../../../../hooks/useLastCallback';

import Avatar from '../../../../components/common/Avatar';
import FullNameTitle from '../../../../components/common/FullNameTitle';
import Button from '../../../../components/ui/Button';
import DropdownMenu from '../../../../components/ui/DropdownMenu';
import MenuItem from '../../../../components/ui/MenuItem';

import styles from './TelebizOrganizations.module.scss';

interface OwnProps {
  member: Partial<OrganizationMember>;
  isDisabled: boolean;
}

interface StateProps {
  peer?: ApiPeer;
  roles: Role[];
  currentUserRoleName?: string;
}

const Member = ({
  member, isDisabled, peer, roles, currentUserRoleName,
}: OwnProps & StateProps) => {
  const { setPendingTelebizOrganization, resolveUserByUsername } = getActions();

  // Resolve user by username if peer is not in global state
  // Check both member.username (from pending org) and member.user?.username (from backend)
  const username = member.username || member.user?.username;
  useEffect(() => {
    if (!peer && username) {
      resolveUserByUsername({ username });
    }
  }, [peer, username, resolveUserByUsername]);

  const isCurrentUserOwner = currentUserRoleName === ORGANIZATION_OWNER_ROLE;
  const isMemberOwner = member.role_name === ORGANIZATION_OWNER_ROLE;

  // Admin cannot edit owners, only owners can
  const canEditMember = isCurrentUserOwner || !isMemberOwner;

  // Filter available roles: admins cannot assign owner role
  const availableRoles = useMemo(() => (
    isCurrentUserOwner ? roles : roles.filter((role) => role.name !== ORGANIZATION_OWNER_ROLE)
  ), [roles, isCurrentUserOwner]);

  const currentRole = useMemo(() => (
    roles.find((role) => role.name === member.role_name)
  ), [roles, member.role_name]);

  const handleRoleChange = useLastCallback((roleName: string) => {
    const global = getGlobal();
    const pendingOrg = selectTelebizPendingOrganization(global);

    const updatedMembers = pendingOrg?.members?.map((m: Partial<OrganizationMember>) => {
      if (m.telegram_id === member.telegram_id) {
        return { ...m, role_name: roleName };
      }
      return m;
    });

    setPendingTelebizOrganization({ key: 'members', value: updatedMembers });
  });

  const isDropdownDisabled = isDisabled || !canEditMember;

  const TriggerButton = useLastCallback(({ onTrigger, isOpen }: { onTrigger: () => void; isOpen?: boolean }) => (
    <Button
      size="smaller"
      color="translucent"
      round
      className={buildClassName(
        styles.memberRoleDropdownTrigger,
        isDropdownDisabled && styles.disabled,
      )}
      iconName="down"
      iconClassName={buildClassName(styles.memberRoleDropdownIcon, isOpen && styles.open)}
      onClick={onTrigger}
      disabled={isDropdownDisabled}
    />
  ));

  const displayName = peer
    ? undefined // FullNameTitle will handle it
    : [member.user?.first_name, member.user?.last_name].filter(Boolean).join(' ')
      || (username ? `@${username}` : 'Unknown User');

  return (
    <div className={styles.member}>
      <div className={styles.memberInfo}>
        <Avatar
          peer={peer}
          size="small"
        />
        <div className={styles.memberInfoRow}>
          {peer ? (
            <FullNameTitle
              peer={peer}
              withEmojiStatus
            />
          ) : (
            <span className={styles.memberName}>{displayName}</span>
          )}
        </div>
      </div>
      <div className={styles.memberRoleDropdown}>
        <span>{currentRole?.description}</span>
        <DropdownMenu
          className={styles.memberRoleDropdownMenu}
          trigger={TriggerButton}
          positionX="right"
          positionY="bottom"
        >
          {availableRoles.map((role) => (
            <MenuItem
              key={role.name}
              onClick={() => handleRoleChange(role.name)}
            >
              {role.description}
            </MenuItem>
          ))}
        </DropdownMenu>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { member }): StateProps => {
    const user = selectTelebizUser(global);
    const pendingOrg = selectTelebizPendingOrganization(global);
    const currentUserMember = pendingOrg?.members?.find(
      (m: Partial<OrganizationMember>) => m.telegram_id === user?.telegram_id,
    );

    return {
      peer: member.telegram_id ? selectPeer(global, member.telegram_id) : undefined,
      roles: selectTelebizRoles(global),
      currentUserRoleName: currentUserMember?.role_name,
    };
  },
)(Member));
