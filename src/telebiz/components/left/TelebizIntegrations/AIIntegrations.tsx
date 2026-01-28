import type { FC } from '../../../../lib/teact/teact';
import { memo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import { TelebizFeatureSection } from '../../../global/types';
import { TelebizSettingsScreens } from '../types';

import {
  selectIsMcpConnected,
  selectIsMcpEnabled,
  selectIsTelebizAgentConnected,
  selectIsTelebizClaudeConnected,
  selectIsTelebizGeminiConnected,
  selectIsTelebizOpenAIConnected,
} from '../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';

import { useTelebizLang } from '../../../hooks/useTelebizLang';

import Icon from '../../../../components/common/icons/Icon';
import ListItem from '../../../../components/ui/ListItem';

import styles from './TelebizIntegrations.module.scss';

type StateProps = {
  isOpenRouterConnected: boolean;
  isClaudeConnected: boolean;
  isOpenAIConnected: boolean;
  isGeminiConnected: boolean;
  isMcpEnabled: boolean;
  isMcpConnected: boolean;
};

const AIIntegrations: FC<StateProps> = ({
  isOpenRouterConnected,
  isClaudeConnected,
  isOpenAIConnected,
  isGeminiConnected,
  isMcpEnabled,
  isMcpConnected,
}) => {
  const { openTelebizSettingsScreen, telebizOpenFeaturesModal } = getActions();

  const lang = useTelebizLang();

  return (
    <div className="settings-content no-border custom-scroll">
      <div className="settings-item">

        <div className={styles.header}>
          <p className="settings-item-description pt-1">
            {lang('Integrations.AI.Description')}
            <a
              className="text-entity-link"
              onClick={() => telebizOpenFeaturesModal({ section: TelebizFeatureSection.AiAgent })}
            >
              {' '}
              {lang('TelebizFeatures.LearnMoreShort')}
            </a>
          </p>
        </div>
        <div className="settings-item pl-0">
          <ListItem
            className={styles.providerItem}
            leftElement={(
              <div className={styles.providerIcon}>
                <img src="/providers/openrouter.svg" alt="OpenRouter" />
                {isOpenRouterConnected && (
                  <span className={styles.providerStatusDot} />
                )}
              </div>
            )}
            ripple
            onClick={() => openTelebizSettingsScreen({ screen: TelebizSettingsScreens.OpenRouterIntegration })}
          >
            <div className={styles.providerInfo}>
              <span className={styles.providerName}>OpenRouter</span>
              <span className={buildClassName(
                styles.providerStatus,
                isOpenRouterConnected ? styles.providerStatusActive : styles.providerStatusInactive,
              )}
              >
                {isOpenRouterConnected
                  ? lang('Agent.Settings.Connected')
                  : lang('Agent.Settings.NotConnected')}
              </span>
            </div>
          </ListItem>

          <ListItem
            className={styles.providerItem}
            leftElement={(
              <div className={styles.providerIcon}>
                <img src="/providers/claude.svg" alt="Claude" />
                {isClaudeConnected && (
                  <span className={styles.providerStatusDot} />
                )}
              </div>
            )}
            ripple
            onClick={() => openTelebizSettingsScreen({ screen: TelebizSettingsScreens.ClaudeIntegration })}
          >
            <div className={styles.providerInfo}>
              <span className={styles.providerName}>Claude</span>
              <span className={buildClassName(
                styles.providerStatus,
                isClaudeConnected ? styles.providerStatusActive : styles.providerStatusInactive,
              )}
              >
                {isClaudeConnected
                  ? lang('Agent.Settings.Connected')
                  : lang('Agent.Settings.NotConnected')}
              </span>
            </div>
          </ListItem>

          <ListItem
            className={styles.providerItem}
            leftElement={(
              <div className={styles.providerIcon}>
                <img src="/providers/openai.svg" alt="OpenAI" />
                {isOpenAIConnected && (
                  <span className={styles.providerStatusDot} />
                )}
              </div>
            )}
            ripple
            onClick={() => openTelebizSettingsScreen({ screen: TelebizSettingsScreens.OpenAIIntegration })}
          >
            <div className={styles.providerInfo}>
              <span className={styles.providerName}>OpenAI</span>
              <span className={buildClassName(
                styles.providerStatus,
                isOpenAIConnected ? styles.providerStatusActive : styles.providerStatusInactive,
              )}
              >
                {isOpenAIConnected
                  ? lang('Agent.Settings.Connected')
                  : lang('Agent.Settings.NotConnected')}
              </span>
            </div>
          </ListItem>

          <ListItem
            className={styles.providerItem}
            leftElement={(
              <div className={styles.providerIcon}>
                <img src="/providers/gemini.png" alt="Gemini" />
                {isGeminiConnected && (
                  <span className={styles.providerStatusDot} />
                )}
              </div>
            )}
            ripple
            onClick={() => openTelebizSettingsScreen({ screen: TelebizSettingsScreens.GeminiIntegration })}
          >
            <div className={styles.providerInfo}>
              <span className={styles.providerName}>Google Gemini</span>
              <span className={buildClassName(
                styles.providerStatus,
                isGeminiConnected ? styles.providerStatusActive : styles.providerStatusInactive,
              )}
              >
                {isGeminiConnected
                  ? lang('Agent.Settings.Connected')
                  : lang('Agent.Settings.NotConnected')}
              </span>
            </div>
          </ListItem>

          <ListItem
            className={styles.providerItem}
            leftElement={(
              <div className={styles.providerIcon}>
                <img src="/providers/mcp.png" alt="Local MCP" />
                {isMcpEnabled && isMcpConnected && (
                  <span className={styles.providerStatusDot} />
                )}
              </div>
            )}
            ripple
            onClick={() => openTelebizSettingsScreen({ screen: TelebizSettingsScreens.McpIntegration })}
          >
            <div className={styles.providerInfo}>
              <span className={styles.providerName}>{lang('Integrations.MCP.Title')}</span>
              <span className={buildClassName(
                styles.providerStatus,
                isMcpEnabled && isMcpConnected ? styles.providerStatusActive : styles.providerStatusInactive,
              )}
              >
                {!isMcpEnabled
                  ? lang('Integrations.MCP.Disabled')
                  : isMcpConnected
                    ? lang('Agent.Settings.Connected')
                    : lang('Agent.Settings.NotConnected')}
              </span>
            </div>
          </ListItem>
        </div>

      </div>

      <div className="settings-item">
        <ListItem
          leftElement={(
            <div className={styles.providerIcon}>
              <Icon name="folder" />
            </div>
          )}
          ripple
          multiline
          onClick={() => openTelebizSettingsScreen({ screen: TelebizSettingsScreens.CustomSkills })}
        >
          <div className={styles.providerInfo}>
            <span className={styles.providerName}>{lang('Agent.Skills.Title')}</span>
            <span className={buildClassName(styles.providerStatus, styles.providerStatusInactive)}>
              {lang('Agent.Skills.Description')}
            </span>
          </div>
        </ListItem>
      </div>

    </div>
  );
};

export default memo(withGlobal(
  (global): Complete<StateProps> => ({
    isOpenRouterConnected: selectIsTelebizAgentConnected(global),
    isClaudeConnected: selectIsTelebizClaudeConnected(global),
    isOpenAIConnected: selectIsTelebizOpenAIConnected(global),
    isGeminiConnected: selectIsTelebizGeminiConnected(global),
    isMcpEnabled: selectIsMcpEnabled(global),
    isMcpConnected: selectIsMcpConnected(global),
  }),
)(AIIntegrations));
