import type { TeactNode } from '@teact';
import { memo, useMemo } from '@teact';
import { getActions, withGlobal } from '../../../../global';

import type { TelebizOrganizationsState } from '../../../global/types';
import type { Organization } from '../../../services';
import { LeftColumnContent } from '../../../../types';
import { TelebizSettingsScreens } from '../types';

import { selectCurrentTelebizOrganization, selectTelebizOrganizations } from '../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';

import useLastCallback from '../../../../hooks/useLastCallback';

import Avatar from '../../../../components/common/Avatar';
import DropdownMenu from '../../../../components/ui/DropdownMenu';
import MenuItem from '../../../../components/ui/MenuItem';

import styles from './TelebizDrawer.module.scss';

type StateProps = {
  organizations: TelebizOrganizationsState;
  currentOrganization?: Organization;
};

const OrganizationSwitcher = ({ organizations, currentOrganization }: StateProps) => {
  const {
    switchTelebizOrganization,
    openLeftColumnContent,
    openTelebizSettingsScreen,
  } = getActions();
  const handleOrganizationSwitch = useLastCallback((organization: Organization) => {
    switchTelebizOrganization({ organization });
  });

  const OrganizationMenuButton = useMemo(() => {
    return ({ onTrigger, isOpen }: { onTrigger: () => void; isOpen?: boolean }): TeactNode => (
      <div
        className={buildClassName(styles.organizationSwitcher, isOpen && styles.organizationSwitcherOpen)}
        onClick={onTrigger}
      >
        <Avatar
          size="small"
          previewUrl={currentOrganization?.logo_url}
          text={currentOrganization?.name}
        />
      </div>
    );
  }, [currentOrganization]);
  return (
    <DropdownMenu
      trigger={OrganizationMenuButton}
      positionX="left"
      positionY="bottom"
    >
      {organizations.organizations.map((organization) => (
        <MenuItem
          key={organization.id}
          onClick={() => handleOrganizationSwitch(organization)}
          className={buildClassName(
            styles.organizationMenuItem,
            organization.id === currentOrganization?.id && styles.organizationMenuItemActive,
          )}
        >
          <Avatar
            size="mini"
            previewUrl={organization.logo_url}
            text={organization.name}
          />
          <span>{organization.name}</span>
        </MenuItem>
      ))}
      <MenuItem
        onClick={() => {
          openLeftColumnContent({ contentKey: LeftColumnContent.Telebiz });
          openTelebizSettingsScreen({ screen: TelebizSettingsScreens.Organizations });
        }}
        icon="add"
      >
        <span>Create</span>
      </MenuItem>
    </DropdownMenu>
  );
};

export default memo(withGlobal((global): StateProps => {
  return {
    organizations: selectTelebizOrganizations(global),
    currentOrganization: selectCurrentTelebizOrganization(global),
  };
})(OrganizationSwitcher));
