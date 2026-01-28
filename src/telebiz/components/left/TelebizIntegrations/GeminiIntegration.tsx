import { memo, useState } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import { TelebizFeatureSection } from '../../../global/types';

import {
  selectIsTelebizAgentEnabled,
  selectIsTelebizGeminiConnected,
  selectIsTelebizGeminiConnecting,
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

const GeminiIntegration = ({
  isConnected,
  isConnecting,
  isAgentEnabled,
}: StateProps) => {
  const lang = useTelebizLang();
  const {
    openUrl,
    telebizConnectGemini,
    telebizDisconnectGemini,
    openTelebizEnableAgentModal,
    disableTelebizAgent,
    telebizOpenFeaturesModal,
    setTelebizActiveProvider,
  } = getActions();

  const [apiKey, setApiKey] = useState('');

  const handleConnect = useLastCallback(() => {
    if (!apiKey.trim()) return;
    telebizConnectGemini({ apiKey: apiKey.trim() });
    setApiKey('');
  });

  const handleDisconnect = useLastCallback(() => {
    telebizDisconnectGemini();
    disableTelebizAgent();
  });

  const handleToggleAgent = useLastCallback(() => {
    if (!isAgentEnabled) {
      setTelebizActiveProvider({ provider: 'gemini' });
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
            <img src="/providers/gemini.png" alt="Gemini" />
          </div>
          <div className={styles.info}>
            <span className={styles.name}>Google Gemini</span>
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
          {lang('Gemini.Integration.Description')}
        </p>
      </div>

      <div className="settings-item">
        {/* Features */}
        <h4 className="settings-item-header">{lang('Gemini.Integration.ImportantInfo')}</h4>
        <p className="settings-item-description mt-3 mb-2">
          {lang('Gemini.Integration.PrivacyNote')}
        </p>
        <ListItem
          icon="info"
          onClick={() => openUrl({ url: 'https://aistudio.google.com/apikey' })}
        >
          {lang('Gemini.Integration.GetApiKey')}
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
          <h4 className="settings-item-header">{lang('Gemini.Integration.AgentMode')}</h4>
          <p className="settings-item-description mt-3 mb-2">
            {lang('Gemini.Integration.AgentModeDescription')}
          </p>

          <ListItem
            icon="bots"
            onClick={handleToggleAgent}
          >
            <span className="menu-item-name">{lang('Gemini.Integration.AgentModeEnabled')}</span>
            <Switcher
              id="gemini-agent-mode-enabled"
              label="Agent Mode Enabled"
              checked={isAgentEnabled}
            />
          </ListItem>
        </div>
      )}

      {/* Rate Limits - show when connected */}
      <div className="settings-item">
        <h4 className="settings-item-header">{lang('Gemini.Integration.RateLimits')}</h4>
        <p className="settings-item-description mt-3 mb-2">
          {lang('Gemini.Integration.RateLimitsDescription')}
        </p>
        <div className={styles.scopesText}>
          <div className={styles.rateLimitList}>
            <div className={styles.rateLimitItem}>
              <span className={styles.rateLimitLabel}>{lang('Gemini.Integration.MaxCallsPerRequest')}</span>
              <span className={styles.rateLimitValue}>20</span>
            </div>
            <div className={styles.rateLimitItem}>
              <span className={styles.rateLimitLabel}>{lang('Gemini.Integration.MaxCallsPerMinute')}</span>
              <span className={styles.rateLimitValue}>30</span>
            </div>
            <div className={styles.rateLimitItem}>
              <span className={styles.rateLimitLabel}>{lang('Gemini.Integration.MinDelay')}</span>
              <span className={styles.rateLimitValue}>500ms</span>
            </div>
            <div className={styles.rateLimitItem}>
              <span className={styles.rateLimitLabel}>{lang('Gemini.Integration.HeavyOpsDelay')}</span>
              <span className={styles.rateLimitValue}>1s</span>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-item">
        {/* Connection Actions */}
        <div className={styles.sectionTitle}>
          {isConnected ? lang('Gemini.Integration.ManageConnection') : lang('Gemini.Integration.Connect')}
        </div>

        {!isConnected ? (
          <>
            <p className={styles.actionDescription}>
              {lang('Gemini.Integration.ConnectDescription')}
            </p>
            <div className={styles.buttonWrapper}>
              <InputText
                id="gemini-api-key"
                label={lang('Gemini.Integration.ApiKeyLabel')}
                value={apiKey}
                onChange={handleApiKeyChange}
                placeholder={lang('Gemini.Integration.ApiKeyPlaceholder')}
              />
            </div>
            <p className={styles.connectHint}>
              {lang('Gemini.Integration.ApiKeyHint')}
            </p>
            <div className={styles.buttonWrapper}>
              <Button
                onClick={handleConnect}
                disabled={!apiKey.trim() || isConnecting}
                isLoading={isConnecting}
              >
                {isConnecting ? lang('Agent.Settings.Connecting') : lang('Gemini.Integration.ConnectButton')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className={styles.actionDescription}>
              {lang('Gemini.Integration.ConnectedDescription')}
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
      isConnected: selectIsTelebizGeminiConnected(global),
      isConnecting: selectIsTelebizGeminiConnecting(global),
      isAgentEnabled: selectIsTelebizAgentEnabled(global) && agentState.activeProvider === 'gemini',
    };
  },
)(GeminiIntegration));
