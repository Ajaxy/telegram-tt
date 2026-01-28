import { memo, useState } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import { TelebizFeatureSection } from '../../../global/types';

import {
  selectIsTelebizAgentEnabled,
  selectIsTelebizClaudeConnected,
  selectIsTelebizClaudeConnecting,
  selectTelebizAgent,
} from '../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';

import useLastCallback from '../../../../hooks/useLastCallback';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import Button from '../../../../components/ui/Button';
import InputText from '../../../../components/ui/InputText';
import ListItem from '../../../../components/ui/ListItem';
import Switcher from '../../../../components/ui/Switcher';

import styles from './TelebizIntegrationDetails.module.scss';

type StateProps = {
  isConnected: boolean;
  isConnecting: boolean;
  isAgentEnabled: boolean;
};

const ClaudeIntegration = ({
  isConnected,
  isConnecting,
  isAgentEnabled,
}: StateProps) => {
  const lang = useTelebizLang();
  const {
    openUrl,
    telebizConnectClaude,
    telebizDisconnectClaude,
    openTelebizEnableAgentModal,
    disableTelebizAgent,
    telebizOpenFeaturesModal,
    setTelebizActiveProvider,
  } = getActions();

  const [apiKey, setApiKey] = useState('');

  const handleConnect = useLastCallback(() => {
    if (!apiKey.trim()) return;
    telebizConnectClaude({ apiKey: apiKey.trim() });
    setApiKey('');
  });

  const handleDisconnect = useLastCallback(() => {
    telebizDisconnectClaude();
    disableTelebizAgent();
  });

  const handleToggleAgent = useLastCallback(() => {
    if (!isAgentEnabled) {
      // Set Claude as the active provider when enabling
      setTelebizActiveProvider({ provider: 'claude' });
      openTelebizEnableAgentModal();
    } else {
      disableTelebizAgent();
    }
  });

  const handleLearnMore = useLastCallback(() => {
    telebizOpenFeaturesModal({ section: TelebizFeatureSection.AiAgent });
  });

  const handleApiKeyChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value);
  });

  return (
    <div className="settings-content custom-scroll">
      {/* Header */}
      <div className="settings-item">
        <div className={styles.header}>
          <div className={styles.icon}>
            <img src="/providers/claude.svg" alt="Claude" />
          </div>
          <div className={styles.info}>
            <span className={styles.name}>Claude</span>
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
          {lang('Claude.Integration.Description')}
        </p>
      </div>

      <div className="settings-item">
        {/* Features */}
        <h4 className="settings-item-header">{lang('Claude.Integration.ImportantInfo')}</h4>
        <p className="settings-item-description mt-3 mb-2">
          {lang('Claude.Integration.PrivacyNote')}
        </p>
        <ListItem
          icon="info"
          onClick={() => openUrl({ url: 'https://console.anthropic.com' })}
        >
          {lang('Claude.Integration.GetApiKey')}
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
          <h4 className="settings-item-header">{lang('Claude.Integration.AgentMode')}</h4>
          <p className="settings-item-description mt-3 mb-2">
            {lang('Claude.Integration.AgentModeDescription')}
          </p>

          <ListItem
            icon="bots"
            onClick={handleToggleAgent}
          >
            <span className="menu-item-name">{lang('Claude.Integration.AgentModeEnabled')}</span>
            <Switcher
              id="claude-agent-mode-enabled"
              label="Agent Mode Enabled"
              checked={isAgentEnabled}
            />
          </ListItem>
        </div>
      )}

      {/* Rate Limits - show when connected */}
      <div className="settings-item">
        <h4 className="settings-item-header">{lang('Claude.Integration.RateLimits')}</h4>
        <p className="settings-item-description mt-3 mb-2">
          {lang('Claude.Integration.RateLimitsDescription')}
        </p>
        <div className={styles.scopesText}>
          <div className={styles.rateLimitList}>
            <div className={styles.rateLimitItem}>
              <span className={styles.rateLimitLabel}>{lang('Claude.Integration.MaxCallsPerRequest')}</span>
              <span className={styles.rateLimitValue}>20</span>
            </div>
            <div className={styles.rateLimitItem}>
              <span className={styles.rateLimitLabel}>{lang('Claude.Integration.MaxCallsPerMinute')}</span>
              <span className={styles.rateLimitValue}>30</span>
            </div>
            <div className={styles.rateLimitItem}>
              <span className={styles.rateLimitLabel}>{lang('Claude.Integration.MinDelay')}</span>
              <span className={styles.rateLimitValue}>500ms</span>
            </div>
            <div className={styles.rateLimitItem}>
              <span className={styles.rateLimitLabel}>{lang('Claude.Integration.HeavyOpsDelay')}</span>
              <span className={styles.rateLimitValue}>1s</span>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-item">
        {/* Connection Actions */}
        <div className={styles.sectionTitle}>
          {isConnected ? lang('Claude.Integration.ManageConnection') : lang('Claude.Integration.Connect')}
        </div>

        {!isConnected ? (
          <>
            <p className={styles.actionDescription}>
              {lang('Claude.Integration.ConnectDescription')}
            </p>
            <div className={styles.buttonWrapper}>
              <InputText
                id="claude-api-key"
                label={lang('Claude.Integration.ApiKeyLabel')}
                value={apiKey}
                onChange={handleApiKeyChange}
                placeholder={lang('Claude.Integration.ApiKeyPlaceholder')}
              />
            </div>
            <p className={styles.connectHint}>
              {lang('Claude.Integration.ApiKeyHint')}
            </p>
            <div className={styles.buttonWrapper}>
              <Button
                onClick={handleConnect}
                disabled={!apiKey.trim() || isConnecting}
                isLoading={isConnecting}
              >
                {isConnecting ? lang('Agent.Settings.Connecting') : lang('Claude.Integration.ConnectButton')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className={styles.actionDescription}>
              {lang('Claude.Integration.ConnectedDescription')}
            </p>
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
  (global): Complete<StateProps> => {
    const agentState = selectTelebizAgent(global);

    return {
      isConnected: selectIsTelebizClaudeConnected(global),
      isConnecting: selectIsTelebizClaudeConnecting(global),
      isAgentEnabled: selectIsTelebizAgentEnabled(global) && agentState.activeProvider === 'claude',
    };
  },
)(ClaudeIntegration));
