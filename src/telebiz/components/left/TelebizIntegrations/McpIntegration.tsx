import { memo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import { selectIsMcpConnected, selectIsMcpEnabled } from '../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';

import useLastCallback from '../../../../hooks/useLastCallback';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import ListItem from '../../../../components/ui/ListItem';
import Switcher from '../../../../components/ui/Switcher';

import styles from './TelebizIntegrationDetails.module.scss';

type StateProps = {
  isMcpEnabled: boolean;
  isMcpConnected: boolean;
};

const CLAUDE_CODE_COMMAND = 'claude mcp add telebiz -- telebiz-mcp';

const NPM_INSTALL_COMMAND = 'npm install -g @telebiz/telebiz-mcp';

const McpIntegration = ({
  isMcpEnabled,
  isMcpConnected,
}: StateProps) => {
  const lang = useTelebizLang();
  const {
    enableMcpBridge,
    disableMcpBridge,
  } = getActions();

  const handleToggleMcp = useLastCallback(() => {
    if (isMcpEnabled) {
      disableMcpBridge();
    } else {
      enableMcpBridge();
    }
  });

  const getStatusText = () => {
    if (!isMcpEnabled) {
      return lang('Integrations.MCP.Disabled');
    }
    return isMcpConnected
      ? lang('Agent.Settings.Connected')
      : lang('Agent.Settings.NotConnected');
  };

  const isActiveAndConnected = isMcpEnabled && isMcpConnected;

  return (
    <div className="settings-content custom-scroll">
      {/* Header */}
      <div className="settings-item">
        <div className={styles.header}>
          <div className={styles.icon}>
            <img src="/providers/mcp.png" alt="Local MCP" />
          </div>
          <div className={styles.info}>
            <span className={styles.name}>{lang('Integrations.MCP.Title')}</span>
            <span className={buildClassName(
              styles.status,
              isActiveAndConnected ? styles.statusActive : styles.statusInactive,
            )}
            >
              <span className={styles.statusDot} />
              {getStatusText()}
            </span>
          </div>
        </div>

        {/* Description */}
        <p className={styles.description}>
          {lang('Integrations.MCP.Description')}
        </p>
      </div>

      {/* Enable Toggle */}
      <div className="settings-item">
        <h4 className="settings-item-header">{lang('Integrations.MCP.EnableBridge')}</h4>
        <ListItem
          icon="bots"
          onClick={handleToggleMcp}
        >
          <span className="menu-item-name">{lang('Integrations.MCP.EnableBridge')}</span>
          <Switcher
            id="mcp-bridge-enabled"
            label={lang('Integrations.MCP.EnableBridge')}
            checked={isMcpEnabled}
          />
        </ListItem>
      </div>

      {/* What is MCP */}
      <div className="settings-item">
        <h4 className="settings-item-header">{lang('Integrations.MCP.WhatIsMcp')}</h4>
        <p className="settings-item-description mt-3">
          {lang('Integrations.MCP.WhatIsMcpDescription')}
        </p>
      </div>

      {/* Setup Instructions - only show when enabled */}
      {isMcpEnabled && (
        <div className="settings-item">
          <h4 className="settings-item-header">{lang('Integrations.MCP.SetupTitle')}</h4>
          <p className="settings-item-description mt-3 mb-1">
            {lang('Integrations.MCP.SetupDescription')}
          </p>

          {/* Claude Code Setup (Recommended) */}
          <div className={styles.scopesText}>
            <div className={styles.rateLimitItem}>
              <span className={styles.rateLimitLabel}>{lang('Integrations.MCP.ClaudeCodeSetup')}</span>
            </div>
            <pre className={styles.codeBlock}>
              {NPM_INSTALL_COMMAND}
              {'\n\n'}
              {CLAUDE_CODE_COMMAND}
            </pre>
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="settings-item">
        <h4 className="settings-item-header">{lang('Integrations.MCP.HowItWorks')}</h4>
        <p className="settings-item-description mt-3">
          {lang('Integrations.MCP.HowItWorksDescription')}
        </p>
        <ul className={styles.list}>
          <li>{lang('Integrations.MCP.HowItWorks1')}</li>
          <li>{lang('Integrations.MCP.HowItWorks2')}</li>
          <li>{lang('Integrations.MCP.HowItWorks3')}</li>
        </ul>
      </div>

      {/* Troubleshooting */}
      <div className="settings-item">
        <h4 className="settings-item-header">{lang('Integrations.MCP.Troubleshooting')}</h4>
        <ul className={styles.list}>
          <li>{lang('Integrations.MCP.TroubleshootingNotConnected')}</li>
          <li>{lang('Integrations.MCP.TroubleshootingPort')}</li>
        </ul>
      </div>
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => ({
    isMcpEnabled: selectIsMcpEnabled(global),
    isMcpConnected: selectIsMcpConnected(global),
  }),
)(McpIntegration));
