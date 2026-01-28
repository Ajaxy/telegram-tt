import type { FC } from '../../../../lib/teact/teact';
import { memo, useCallback } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import { TelebizFeatureSection } from '../../../global/types';

import {
  selectIsTelebizAgentConnected,
  selectIsTelebizAgentEnabled,
  selectTelebizAgent,
} from '../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';

import { useTelebizLang } from '../../../hooks/useTelebizLang';

import Button from '../../../../components/ui/Button';
import ListItem from '../../../../components/ui/ListItem';
import Switcher from '../../../../components/ui/Switcher';

import styles from './TelebizIntegrationDetails.module.scss';

type StateProps = {
  isConnected: boolean;
  isAgentEnabled: boolean;
  balance?: number;
  isLoadingBalance: boolean;
};

const OpenRouterIntegration: FC<StateProps> = ({
  isConnected,
  isAgentEnabled,
  balance,
  isLoadingBalance,
}) => {
  const lang = useTelebizLang();
  const {
    openUrl,
    telebizConnectOpenRouter,
    telebizDisconnectOpenRouter,
    openTelebizEnableAgentModal,
    disableTelebizAgent,
    telebizOpenFeaturesModal,
  } = getActions();

  const handleConnect = useCallback(() => {
    telebizConnectOpenRouter();
  }, [telebizConnectOpenRouter]);

  const handleDisconnect = useCallback(() => {
    telebizDisconnectOpenRouter();
    disableTelebizAgent();
  }, [telebizDisconnectOpenRouter, disableTelebizAgent]);

  const handleToggleAgent = useCallback(() => {
    if (!isAgentEnabled) {
      openTelebizEnableAgentModal();
    } else {
      disableTelebizAgent();
    }
  }, [isAgentEnabled, openTelebizEnableAgentModal, disableTelebizAgent]);

  const handleLearnMore = useCallback(() => {
    telebizOpenFeaturesModal({ section: TelebizFeatureSection.AiAgent });
  }, [telebizOpenFeaturesModal]);

  return (
    <div className="settings-content custom-scroll">
      {/* Header */}
      <div className="settings-item">
        <div className={styles.header}>
          <div className={styles.icon}>
            <img src="/providers/openrouter.svg" alt="OpenRouter" />
          </div>
          <div className={styles.info}>
            <span className={styles.name}>OpenRouter</span>
            <span className={buildClassName(
              styles.status,
              isConnected ? styles.statusActive : styles.statusInactive,
            )}
            >
              <span className={styles.statusDot} />
              {isConnected ? lang('Agent.Settings.Connected') : lang('Agent.Settings.NotConnected')}
            </span>
          </div>
        </div>

        {/* Description */}
        <p className={styles.description}>
          OpenRouter provides access to various AI models including Claude, GPT-5, and Gemini.
          Connect your OpenRouter account to use the Agent feature.
        </p>
      </div>

      <div className="settings-item">
        {/* Features */}
        <h4 className="settings-item-header">Important Information</h4>
        <p className="settings-item-description mt-3 mb-2">
          Telebiz does not store any of your data on our servers.
          All conversations are processed directly through OpenRouter and never stored on our servers.
        </p>
        <ListItem
          icon="info"
          onClick={() => openUrl({ url: 'https://trust.openrouter.ai' })}
        >
          OpenRouter&apos;s trust policy
        </ListItem>
        <ListItem
          icon="info"
          onClick={handleLearnMore}
        >
          {lang('TelebizFeatures.LearnMoreShort')}
        </ListItem>
      </div>

      {/* Agent Mode Enable/Disable - only show when connected */}
      {isConnected && (
        <div className="settings-item">
          <h4 className="settings-item-header">Agent Mode</h4>
          <p className="settings-item-description mt-3 mb-2">
            Agent mode allows the AI to perform actions on your Telegram account,
            including sending messages, managing chats, and more.
          </p>

          <ListItem
            icon="bots"
            onClick={handleToggleAgent}
          >
            <span className="menu-item-name">Agent Mode Enabled</span>
            <Switcher
              id="agent-mode-enabled"
              label="Agent Mode Enabled"
              checked={isAgentEnabled}
            />
          </ListItem>
        </div>
      )}

      {/* Rate Limits - show when connected */}
      <div className="settings-item">
        <h4 className="settings-item-header">Rate Limits</h4>
        <p className="settings-item-description mt-3 mb-2">
          To protect your Telegram account from flood bans, the agent enforces these limits:
        </p>
        <div className={styles.scopesText}>
          <div className={styles.rateLimitList}>
            <div className={styles.rateLimitItem}>
              <span className={styles.rateLimitLabel}>Max calls per request</span>
              <span className={styles.rateLimitValue}>20</span>
            </div>
            <div className={styles.rateLimitItem}>
              <span className={styles.rateLimitLabel}>Max calls per minute</span>
              <span className={styles.rateLimitValue}>30</span>
            </div>
            <div className={styles.rateLimitItem}>
              <span className={styles.rateLimitLabel}>Min delay between calls</span>
              <span className={styles.rateLimitValue}>500ms</span>
            </div>
            <div className={styles.rateLimitItem}>
              <span className={styles.rateLimitLabel}>Delay for heavy operations</span>
              <span className={styles.rateLimitValue}>1s</span>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-item">
        {/* Connection Actions */}
        <div className={styles.sectionTitle}>
          {isConnected ? 'Manage Connection' : 'Connect'}
        </div>

        {!isConnected ? (
          <>
            <p className={styles.actionDescription}>
              {lang('Agent.Settings.IntegrationInfo')}
            </p>
            <div className={styles.buttonWrapper}>
              <Button onClick={handleConnect}>
                {lang('Agent.Settings.ConnectOpenRouter')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className={styles.actionDescription}>
              {lang('Agent.Settings.ConnectedDescription')}
            </p>
            {/* Balance */}
            <div className={styles.balanceSection}>
              <span className={styles.balanceLabel}>Balance:</span>
              <span className={styles.balanceValue}>
                {isLoadingBalance ? 'Loading...' : balance !== undefined ? `$${balance.toFixed(4)}` : 'N/A'}
              </span>
            </div>
            <div className={styles.buttonWrapper}>
              <Button
                color="danger"
                isText
                onClick={handleDisconnect}
              >
                {lang('Agent.Settings.Disconnect')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    const agentState = selectTelebizAgent(global);

    return {
      isConnected: selectIsTelebizAgentConnected(global),
      isAgentEnabled: selectIsTelebizAgentEnabled(global),
      balance: agentState.balance,
      isLoadingBalance: agentState.isLoadingBalance,
    };
  },
)(OpenRouterIntegration));
