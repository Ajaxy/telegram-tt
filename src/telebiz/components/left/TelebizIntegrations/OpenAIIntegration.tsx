import { memo, useState } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import { TelebizFeatureSection } from '../../../global/types';

import {
  selectIsTelebizAgentEnabled,
  selectIsTelebizOpenAIConnected,
  selectIsTelebizOpenAIConnecting,
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

const OpenAIIntegration = ({
  isConnected,
  isConnecting,
  isAgentEnabled,
}: StateProps) => {
  const lang = useTelebizLang();
  const {
    openUrl,
    telebizConnectOpenAI,
    telebizDisconnectOpenAI,
    openTelebizEnableAgentModal,
    disableTelebizAgent,
    telebizOpenFeaturesModal,
    setTelebizActiveProvider,
  } = getActions();

  const [apiKey, setApiKey] = useState('');

  const handleConnect = useLastCallback(() => {
    if (!apiKey.trim()) return;
    telebizConnectOpenAI({ apiKey: apiKey.trim() });
    setApiKey('');
  });

  const handleDisconnect = useLastCallback(() => {
    telebizDisconnectOpenAI();
    disableTelebizAgent();
  });

  const handleToggleAgent = useLastCallback(() => {
    if (!isAgentEnabled) {
      setTelebizActiveProvider({ provider: 'openai' });
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
            <img src="/providers/openai.svg" alt="OpenAI" />
          </div>
          <div className={styles.info}>
            <span className={styles.name}>OpenAI</span>
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
          {lang('OpenAI.Integration.Description')}
        </p>
      </div>

      <div className="settings-item">
        {/* Features */}
        <h4 className="settings-item-header">{lang('OpenAI.Integration.ImportantInfo')}</h4>
        <p className="settings-item-description mt-3 mb-2">
          {lang('OpenAI.Integration.PrivacyNote')}
        </p>
        <ListItem
          icon="info"
          onClick={() => openUrl({ url: 'https://platform.openai.com/api-keys' })}
        >
          {lang('OpenAI.Integration.GetApiKey')}
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
          <h4 className="settings-item-header">{lang('OpenAI.Integration.AgentMode')}</h4>
          <p className="settings-item-description mt-3 mb-2">
            {lang('OpenAI.Integration.AgentModeDescription')}
          </p>

          <ListItem
            icon="bots"
            onClick={handleToggleAgent}
          >
            <span className="menu-item-name">{lang('OpenAI.Integration.AgentModeEnabled')}</span>
            <Switcher
              id="openai-agent-mode-enabled"
              label="Agent Mode Enabled"
              checked={isAgentEnabled}
            />
          </ListItem>
        </div>
      )}

      {/* Rate Limits - show when connected */}
      <div className="settings-item">
        <h4 className="settings-item-header">{lang('OpenAI.Integration.RateLimits')}</h4>
        <p className="settings-item-description mt-3 mb-2">
          {lang('OpenAI.Integration.RateLimitsDescription')}
        </p>
        <div className={styles.scopesText}>
          <div className={styles.rateLimitList}>
            <div className={styles.rateLimitItem}>
              <span className={styles.rateLimitLabel}>{lang('OpenAI.Integration.MaxCallsPerRequest')}</span>
              <span className={styles.rateLimitValue}>20</span>
            </div>
            <div className={styles.rateLimitItem}>
              <span className={styles.rateLimitLabel}>{lang('OpenAI.Integration.MaxCallsPerMinute')}</span>
              <span className={styles.rateLimitValue}>30</span>
            </div>
            <div className={styles.rateLimitItem}>
              <span className={styles.rateLimitLabel}>{lang('OpenAI.Integration.MinDelay')}</span>
              <span className={styles.rateLimitValue}>500ms</span>
            </div>
            <div className={styles.rateLimitItem}>
              <span className={styles.rateLimitLabel}>{lang('OpenAI.Integration.HeavyOpsDelay')}</span>
              <span className={styles.rateLimitValue}>1s</span>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-item">
        {/* Connection Actions */}
        <div className={styles.sectionTitle}>
          {isConnected ? lang('OpenAI.Integration.ManageConnection') : lang('OpenAI.Integration.Connect')}
        </div>

        {!isConnected ? (
          <>
            <p className={styles.actionDescription}>
              {lang('OpenAI.Integration.ConnectDescription')}
            </p>
            <div className={styles.buttonWrapper}>
              <InputText
                id="openai-api-key"
                label={lang('OpenAI.Integration.ApiKeyLabel')}
                value={apiKey}
                onChange={handleApiKeyChange}
                placeholder={lang('OpenAI.Integration.ApiKeyPlaceholder')}
              />
            </div>
            <p className={styles.connectHint}>
              {lang('OpenAI.Integration.ApiKeyHint')}
            </p>
            <div className={styles.buttonWrapper}>
              <Button
                onClick={handleConnect}
                disabled={!apiKey.trim() || isConnecting}
                isLoading={isConnecting}
              >
                {isConnecting ? lang('Agent.Settings.Connecting') : lang('OpenAI.Integration.ConnectButton')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className={styles.actionDescription}>
              {lang('OpenAI.Integration.ConnectedDescription')}
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
      isConnected: selectIsTelebizOpenAIConnected(global),
      isConnecting: selectIsTelebizOpenAIConnecting(global),
      isAgentEnabled: selectIsTelebizAgentEnabled(global) && agentState.activeProvider === 'openai',
    };
  },
)(OpenAIIntegration));
