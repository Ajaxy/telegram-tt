import type { ChangeEvent } from 'react';
import type { FC } from '../../../../lib/teact/teact';
import { memo, useCallback, useMemo, useRef, useState } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { Integration, Organization, Provider, Team } from '../../../services/types';

import {
  selectCurrentTelebizOrganization,
  selectCurrentTelebizTeam,
  selectTelebizIntegrationsList,
  selectTelebizProviders,
  selectTelebizSelectedProviderName,
} from '../../../global/selectors';
import { IS_OPEN_IN_NEW_TAB_SUPPORTED } from '../../../../util/browser/windowEnvironment';
import buildClassName from '../../../../util/buildClassName';
import PopupManager from '../../../util/PopupManager';
import { IntegrationStatus, telebizApiClient } from '../../../services';

import useFlag from '../../../../hooks/useFlag';
import useLastCallback from '../../../../hooks/useLastCallback';
import useBackgroundMode from '../../../../hooks/window/useBackgroundMode';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import Button from '../../../../components/ui/Button';
import ConfirmDialog from '../../../../components/ui/ConfirmDialog';
import Loading from '../../../../components/ui/Loading';

import styles from './TelebizIntegrationDetails.module.scss';

let oAuthPopupManager: PopupManager | undefined;

type StateProps = {
  integrations: Integration[];
  providers: Provider[];
  selectedProviderName?: string;
  currentOrganization?: Organization;
  currentTeam?: Team;
};

const TelebizIntegrationDetails: FC<StateProps> = ({
  integrations,
  providers,
  selectedProviderName,
  currentOrganization,
  currentTeam,
}) => {
  const {
    loadTelebizIntegrations,
    loadTelebizProviderProperties,
    updateTelebizIntegrationSettings,
    loadTelebizRelationships,
  } = getActions();

  const lang = useTelebizLang();

  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const [isAwaitingOAuthReturn, setIsAwaitingOAuthReturn] = useState(false);
  const [isDisconnectModalOpen, openDisconnectModal, closeDisconnectModal] = useFlag(false);

  const pollTimerRef = useRef<number | undefined>();
  const authWindowRef = useRef<WindowProxy | undefined>();
  const messageListenerRef = useRef<((event: MessageEvent) => void) | undefined>();

  const provider = useMemo(() => {
    return providers.find((p) => p.name === selectedProviderName);
  }, [providers, selectedProviderName]);

  const integration = useMemo(() => {
    return integrations.find((i) => i.provider.name === selectedProviderName);
  }, [integrations, selectedProviderName]);

  const isConnected = integration?.status === IntegrationStatus.Active;
  const hasMissingScopes = integration?.missing_scopes && integration.missing_scopes.length > 0;
  const canConnect = Boolean(currentOrganization?.id);

  const cleanupOAuth = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = undefined;
    }

    if (messageListenerRef.current) {
      window.removeEventListener('message', messageListenerRef.current);
      messageListenerRef.current = undefined;
    }

    authWindowRef.current = undefined;
    setIsAwaitingOAuthReturn(false);
  }, []);

  const handleFocus = useCallback(() => {
    if (isAwaitingOAuthReturn) {
      setIsAwaitingOAuthReturn(false);
      loadTelebizIntegrations();
      if (integration?.id) {
        loadTelebizProviderProperties({ integrationId: integration.id, forceRefresh: true });
        loadTelebizRelationships();
      }
    }
  }, [isAwaitingOAuthReturn, loadTelebizIntegrations, integration?.id]);

  useBackgroundMode(undefined, handleFocus);

  const handleConnect = useLastCallback(async () => {
    if (!provider) return;

    try {
      const response = await telebizApiClient.integrations.startOAuth({
        provider: provider.name,
        organizationId: currentOrganization?.id,
        teamId: currentTeam?.id,
      });

      cleanupOAuth();

      if (!IS_OPEN_IN_NEW_TAB_SUPPORTED) {
        setIsAwaitingOAuthReturn(true);
        window.location.href = response.authUrl;
        return;
      }

      if (!oAuthPopupManager) {
        oAuthPopupManager = new PopupManager(
          'width=600,height=700,scrollbars=yes,resizable=yes',
          () => {},
        );
      }

      oAuthPopupManager.preOpenIfNeeded();

      const handleOAuthMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        if (event.data?.type === 'OAUTH_CALLBACK') {
          cleanupOAuth();
          loadTelebizIntegrations();
          if (integration?.id) {
            loadTelebizProviderProperties({ integrationId: integration.id, forceRefresh: true });
            loadTelebizRelationships();
          }
        }
      };

      messageListenerRef.current = handleOAuthMessage;
      window.addEventListener('message', handleOAuthMessage);

      try {
        if (oAuthPopupManager) {
          oAuthPopupManager.open(response.authUrl);
        } else {
          authWindowRef.current = window.open(
            response.authUrl,
            'oauth-popup',
            'width=600,height=700,scrollbars=yes,resizable=yes',
          ) || undefined;
        }

        setIsAwaitingOAuthReturn(true);

        pollTimerRef.current = window.setInterval(() => {
          try {
            if (authWindowRef.current?.closed) {
              cleanupOAuth();
              loadTelebizIntegrations();
              if (integration?.id) {
                loadTelebizProviderProperties({ integrationId: integration.id, forceRefresh: true });
                loadTelebizRelationships();
              }
            }
          } catch (err) {
            // Handle cross-origin errors silently
          }
        }, 1000);

        setTimeout(() => {
          if (messageListenerRef.current === handleOAuthMessage) {
            cleanupOAuth();
          }
        }, 300000);
      } catch (err) {
        cleanupOAuth();
        setIsAwaitingOAuthReturn(true);
        window.location.href = response.authUrl;
      }
    } catch (err) {
      // Handle error
    }
  });

  const handleToggleActivitySync = useLastCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    if (!integration) return;

    const isEnabled = e.target.checked;
    setIsUpdatingSettings(true);
    try {
      updateTelebizIntegrationSettings({
        integrationId: integration.id,
        settings: { activitySyncEnabled: isEnabled },
      });
    } finally {
      setIsUpdatingSettings(false);
    }
  });

  const handleDisconnect = useLastCallback(async () => {
    if (!integration) return;

    try {
      await telebizApiClient.integrations.disconnectIntegration(integration.id);
      closeDisconnectModal();
      loadTelebizIntegrations();
      loadTelebizRelationships();
    } catch (err) {
      // Handle error
    }
  });

  const getStatusClass = (status: Integration['status']) => {
    switch (status) {
      case IntegrationStatus.Active:
        return styles.statusActive;
      case IntegrationStatus.Error:
        return styles.statusError;
      case IntegrationStatus.Expired:
        return styles.statusExpired;
      default:
        return styles.statusPending;
    }
  };

  const getStatusLabel = (status: Integration['status']) => {
    switch (status) {
      case IntegrationStatus.Active:
        return lang('Integrations.Details.StatusActive');
      case IntegrationStatus.Error:
        return lang('Integrations.Details.StatusError');
      case IntegrationStatus.Expired:
        return lang('Integrations.Details.StatusExpired');
      default:
        return lang('Integrations.Details.StatusPending');
    }
  };

  if (!provider) {
    return (
      <div className="settings-content custom-scroll">
        <Loading />
      </div>
    );
  }

  const hasGrantedScopes = integration?.granted_scopes && integration.granted_scopes.length > 0;
  const hasRequiredScopes = provider.default_scopes && provider.default_scopes.length > 0;

  return (
    <div className="settings-content custom-scroll">
      {/* Header */}
      <div className="settings-item">
        <div className={styles.header}>
          <div className={styles.icon}>
            <img src={provider.icon_url} alt={provider.display_name} />
          </div>
          <div className={styles.info}>
            <span className={styles.name}>{provider.display_name}</span>
            {isConnected && integration.provider_account_email && (
              <span className={styles.email}>{integration.provider_account_email}</span>
            )}
            <span className={buildClassName(
              styles.status,
              isConnected ? getStatusClass(integration.status) : styles.statusInactive,
            )}
            >
              <span className={styles.statusDot} />
              {isConnected ? getStatusLabel(integration.status) : lang('Integrations.NotConnected')}
            </span>
          </div>
        </div>
        <p className="settings-item-description mt-3 mb-2">{provider.description}</p>
      </div>

      {/* Not connected: show required scopes and connect button */}
      {!isConnected && (
        <>
          {hasRequiredScopes && (
            <div className="settings-item">
              <h4 className="settings-item-header">{lang('Integrations.RequiredScopes')}</h4>
              <div className={styles.scopesText}>
                {provider.default_scopes.join(', ')}
              </div>
            </div>
          )}

          <div className="settings-item">
            <div className={styles.buttonWrapper}>
              <Button
                color="primary"
                disabled={!canConnect}
                onClick={handleConnect}
              >
                {hasMissingScopes ? lang('Integrations.GrantScopes') : lang('Integrations.Connect')}
              </Button>
            </div>
            {!canConnect && (
              <p className={styles.connectHint}>
                {lang('Integrations.ConnectHint')}
              </p>
            )}
          </div>
        </>
      )}

      {/* Connected: show settings and management options */}
      {isConnected && (
        <>
          {hasGrantedScopes && (
            <div className="settings-item">
              <h4 className="settings-item-header">{lang('Integrations.Details.GrantedScopes')}</h4>
              <div className={styles.scopesText}>
                {integration.granted_scopes.join(', ')}
              </div>
            </div>
          )}

          <div className="settings-item">
            <h4 className="settings-item-header">{lang('Integrations.Details.ManageConnection')}</h4>
            <p className="settings-item-description mt-3 mb-2">
              {lang('Integrations.Details.RefreshAuthDescription')}
            </p>
            <div className={styles.buttonWrapper}>
              <Button
                isText
                onClick={handleConnect}
              >
                {lang('Integrations.Details.RefreshAuth')}
              </Button>
            </div>
          </div>

          <div className="settings-item">
            <div className={styles.buttonWrapper}>
              <Button
                color="danger"
                isText
                onClick={openDisconnectModal}
              >
                {lang('Integrations.Disconnect')}
              </Button>
            </div>
          </div>

          <ConfirmDialog
            isOpen={isDisconnectModalOpen}
            onClose={closeDisconnectModal}
            confirmIsDestructive
            confirmHandler={handleDisconnect}
            title={lang('Integrations.Details.DisconnectTitle')}
            text={lang('Integrations.Details.DisconnectConfirm', { provider: provider.display_name })}
            confirmLabel={lang('Integrations.Disconnect')}
          />
        </>
      )}
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => ({
    integrations: selectTelebizIntegrationsList(global),
    providers: selectTelebizProviders(global),
    selectedProviderName: selectTelebizSelectedProviderName(global),
    currentOrganization: selectCurrentTelebizOrganization(global),
    currentTeam: selectCurrentTelebizTeam(global),
  }),
)(TelebizIntegrationDetails));
