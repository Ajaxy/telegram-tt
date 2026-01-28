import type { FC } from '../../../../lib/teact/teact';
import { memo, useCallback, useMemo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { TelebizLangPack } from '../../../lang/telebizLangPack';
import type { Integration, Organization, Provider } from '../../../services/types';
import { TelebizFeatureSection } from '../../../global/types';
import { TelebizSettingsScreens } from '../types';

import {
  selectCurrentTelebizOrganization,
  selectTelebizAuthIsLoading,
  selectTelebizIntegrations,
  selectTelebizIntegrationsList,
  selectTelebizProviders,
} from '../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';

import { useTelebizLang } from '../../../hooks/useTelebizLang';

import ListItem from '../../../../components/ui/ListItem';
import Loading from '../../../../components/ui/Loading';
import RoundWarningFill from '../../icons/RoundWarningFill';

import styles from './TelebizIntegrations.module.scss';

type StateProps = {
  isAuthLoading: boolean;
  currentOrganization?: Organization;
  integrations: Integration[];
  providers: Provider[];
  isLoadingIntegrations: boolean;
  isLoadingProviders: boolean;
};

const TelebizIntegrations: FC<StateProps> = ({
  isAuthLoading,
  currentOrganization,
  integrations,
  providers,
  isLoadingIntegrations,
  isLoadingProviders,
}) => {
  const {
    openTelebizSettingsScreen,
    setTelebizSelectedProviderName,
    telebizOpenFeaturesModal,
  } = getActions();

  const lang = useTelebizLang();

  const handleProviderClick = useCallback((provider: Provider) => {
    setTelebizSelectedProviderName({ providerName: provider.name });
    openTelebizSettingsScreen({ screen: TelebizSettingsScreens.IntegrationDetails });
  }, [setTelebizSelectedProviderName, openTelebizSettingsScreen]);

  const providersByCategory = useMemo(() => {
    return providers.reduce((acc, provider) => {
      acc[provider.category] = acc[provider.category] || [];
      acc[provider.category].push(provider);
      return acc;
    }, {} as Record<string, Provider[]>);
  }, [providers]);

  const canConnectIntegration = Boolean(currentOrganization?.id);

  if (isAuthLoading || isLoadingProviders || isLoadingIntegrations) {
    return (
      <div className="settings-content no-border">
        <Loading />
      </div>
    );
  }

  return (
    <div className="settings-content no-border custom-scroll">
      <div className={styles.container}>
        {!canConnectIntegration && (
          <div className={styles.noOrganization}>
            <RoundWarningFill />
            <div className={styles.noOrganizationContent}>
              <div>You must join an organization first to connect integrations</div>
              <a
                className="text-entity-link"
                onClick={() => {
                  openTelebizSettingsScreen({ screen: TelebizSettingsScreens.Organizations });
                }}
              >
                Learn more
              </a>
            </div>
          </div>
        )}

        <div className={styles.header}>
          <p className="settings-item-description pt-1">
            {lang('Integrations.Description')}
            <a
              className="text-entity-link"
              onClick={() => telebizOpenFeaturesModal({ section: TelebizFeatureSection.Integrations })}
            >
              {' '}
              {lang('TelebizFeatures.LearnMoreShort')}
            </a>
          </p>
        </div>

        <div className="settings-item pl-0">
          {Object.entries(providersByCategory).map(([category, categoryProviders]) => (
            <div key={category}>
              <h4 className="settings-item-header">
                {lang(`Integrations.${category.toUpperCase()}` as keyof TelebizLangPack)}
              </h4>
              {categoryProviders.map((provider) => {
                const integration = integrations.find((i) => i.provider.name === provider.name);
                const isConnected = integration?.status === 'active';

                return (
                  <ListItem
                    key={provider.id}
                    className={styles.providerItem}
                    leftElement={(
                      <div className={styles.providerIcon}>
                        <img src={provider.icon_url} alt={provider.display_name} />
                        {isConnected && (
                          <span className={styles.providerStatusDot} />
                        )}
                      </div>
                    )}
                    ripple
                    onClick={() => handleProviderClick(provider)}
                  >
                    <div className={styles.providerInfo}>
                      <span className={styles.providerName}>{provider.display_name}</span>
                      <span className={buildClassName(
                        styles.providerStatus,
                        isConnected ? styles.providerStatusActive : styles.providerStatusInactive,
                      )}
                      >
                        {isConnected
                          ? (integration.provider_account_email || lang('Integrations.Details.StatusActive'))
                          : lang('Integrations.NotConnected')}
                      </span>
                    </div>
                  </ListItem>
                );
              })}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    const integrationsState = selectTelebizIntegrations(global);

    return {
      isAuthLoading: selectTelebizAuthIsLoading(global),
      currentOrganization: selectCurrentTelebizOrganization(global),
      integrations: selectTelebizIntegrationsList(global),
      providers: selectTelebizProviders(global),
      isLoadingIntegrations: integrationsState.isLoading,
      isLoadingProviders: integrationsState.isLoadingProviders,
    };
  },
)(TelebizIntegrations));
