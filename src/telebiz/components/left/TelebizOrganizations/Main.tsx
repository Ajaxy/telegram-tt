import type { FC } from '../../../../lib/teact/teact';
import { memo, useEffect, useState } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { Organization, OrganizationInvitation } from '../../../services';
import type { OrganizationMember, TelebizUser } from '../../../services/types';
import { TelebizFeatureSection } from '../../../global/types';
import { TelebizSettingsScreens } from '../types';

import { ORGANIZATION_MANAGER_ROLES } from '../../../config/constants';
import {
  selectIsTelebizAuthenticated,
  selectTelebizAuthIsLoading,
  selectTelebizOrganizationsError,
  selectTelebizOrganizationsIsLoading,
  selectTelebizOrganizationsList,
  selectTelebizUser,
} from '../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { telebizApiClient } from '../../../services';

import useOldLang from '../../../../hooks/useOldLang';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import Avatar from '../../../../components/common/Avatar';
import Button from '../../../../components/ui/Button';
import ListItem from '../../../../components/ui/ListItem';
import Loading from '../../../../components/ui/Loading';
import ShieldWarningFill from '../../icons/ShieldWarningFill';

import styles from './TelebizOrganizations.module.scss';

type StateProps = {
  isAuthenticated: boolean;
  isLoading: boolean;
  user?: TelebizUser;
  organizations: Organization[];
  isLoadingOrganizations: boolean;
  error?: string;
};

const TelebizOrganizationsMain: FC<StateProps> = ({
  isAuthenticated,
  isLoading,
  user,
  organizations,
  isLoadingOrganizations,
  error,
}) => {
  const {
    openTelebizSettingsScreen,
    acceptTelebizOrganizationInvitation,
    setPendingTelebizOrganization,
    resetPendingTelebizOrganization,
    telebizOpenFeaturesModal,
  } = getActions();

  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);

  useEffect(() => {
    if (isAuthenticated) {
      telebizApiClient.organizations.getMyInvitations().then((inv) => {
        setInvitations(inv);
      });
    }
  }, [isAuthenticated]);

  const lang = useTelebizLang();
  const tgLang = useOldLang();

  const renderNoOrganizations = () => {
    return (
      <div className="settings-item pt-3">
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <img src="/organization-ph.svg" alt="Organization placeholder" />
          </div>
          <div className={styles.emptyContent}>
            <h3>{lang('No organizations found')}</h3>
            <p>{lang('Start using Telebiz by joining an organization')}</p>
            <a
              className="text-entity-link"
              onClick={() => telebizOpenFeaturesModal({ section: TelebizFeatureSection.Organizations })}
            >
              {lang('TelebizFeatures.LearnMoreShort')}
            </a>
          </div>
        </div>
      </div>
    );
  };

  const OrganizationItem = ({ organization }: { organization: Organization }) => (
    <div className={styles.organizationInfo}>
      <Avatar
        previewUrl={organization?.logo_url}
        text={organization?.name}
      />
      <div className={styles.organizationInfoDetails}>
        <div>
          {organization?.name}
        </div>
        <div className={styles.organizationInfoDetailsDescription}>
          {organization?.description}
        </div>
      </div>
    </div>
  );

  const renderOrganizations = () => {
    return (
      <div className={buildClassName(styles.organizations, 'settings-item pr-2', 'custom-scroll')}>
        <h4
          className="settings-item-header mb-3"
          dir={tgLang.isRtl ? 'rtl' : undefined}
        >
          {lang('Your Organizations')}
        </h4>
        {organizations.map((organization) => {
          const member = organization.members?.find(
            (m: Partial<OrganizationMember>) => m.user_id === user?.id,
          );
          const isManager = Boolean(member?.role_name && ORGANIZATION_MANAGER_ROLES.includes(member.role_name));
          return (
            <ListItem
              key={organization.id}
              narrow
              multiline
              allowSelection={isManager}
              isStatic={!isManager}
              onClick={() => {
                if (isManager) {
                  openTelebizSettingsScreen({ screen: TelebizSettingsScreens.OrganizationsEdit });
                  setPendingTelebizOrganization({ key: organization });
                }
              }}
            >
              <OrganizationItem organization={organization} />
            </ListItem>
          );
        })}
      </div>
    );
  };

  const renderInvitations = () => {
    return (
      <div className={styles.invitations}>
        {invitations.map((invitation) => (
          <ListItem
            key={invitation.id}
            narrow
            allowSelection={false}
            isStatic
          >
            <OrganizationItem organization={invitation.organization} />
            <Button
              className={styles.invitationButton}
              color="primary"
              pill
              fluid
              size="smaller"
              onClick={() => {
                acceptTelebizOrganizationInvitation({ invitationId: invitation.id });
                setInvitations(invitations.filter((i) => i.id !== invitation.id));
              }}
            >
              {lang('Accept')}
            </Button>
          </ListItem>
        ))}
      </div>
    );
  };

  if (isLoading || isLoadingOrganizations) {
    return <Loading />;
  }

  if (error) {
    return (
      <div className="error-state">
        <div className="error-message">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {!organizations.length && renderNoOrganizations()}
      {organizations.length > 0 && renderOrganizations()}
      <div className="settings-item pt-3">
        <div className={styles.createOrganization}>
          <Button
            className="settings-button with-icon"
            color="primary"
            pill
            fluid
            onClick={() => {
              resetPendingTelebizOrganization();
              openTelebizSettingsScreen({ screen: TelebizSettingsScreens.OrganizationsCreate });
            }}
            iconName="add"
          >
            {lang('Create Organization')}
          </Button>
          <div className={styles.hint}>
            <div className={styles.hintIcon}>
              <ShieldWarningFill />
            </div>
            <div className={styles.hintText}>
              {lang('Telebiz won\'t share or log anything without your permission')}
            </div>
          </div>
        </div>
      </div>
      {invitations.length > 0 && (
        <div className="settings-item pt-3">
          <h4 className="settings-item-header mb-3" dir={tgLang.isRtl ? 'rtl' : undefined}>{lang('Invitations')}</h4>
          {renderInvitations()}
        </div>
      )}
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => ({
    isAuthenticated: selectIsTelebizAuthenticated(global),
    isLoading: selectTelebizAuthIsLoading(global),
    user: selectTelebizUser(global),
    organizations: selectTelebizOrganizationsList(global),
    isLoadingOrganizations: selectTelebizOrganizationsIsLoading(global),
    error: selectTelebizOrganizationsError(global),
  }),
)(TelebizOrganizationsMain));
