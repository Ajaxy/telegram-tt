import { memo } from '../../../../lib/teact/teact';

import { TelebizSettingsScreens } from '../types';

import TelebizOrganizationsMain from './Main';
import TelebizOrganizationsManage from './Manage';

export type OwnProps = {
  currentScreen: TelebizSettingsScreens;
};

const Organizations = ({
  currentScreen,
}: OwnProps) => {
  switch (currentScreen) {
    case TelebizSettingsScreens.Organizations:
      return (
        <TelebizOrganizationsMain />
      );
    case TelebizSettingsScreens.OrganizationsCreate:
    case TelebizSettingsScreens.OrganizationsEdit:
    case TelebizSettingsScreens.OrganizationsAddMembers:
    case TelebizSettingsScreens.OrganizationsPayment:
      return (
        <TelebizOrganizationsManage currentScreen={currentScreen} />
      );
    default:
      return undefined;
  }
};

export default memo(Organizations);
