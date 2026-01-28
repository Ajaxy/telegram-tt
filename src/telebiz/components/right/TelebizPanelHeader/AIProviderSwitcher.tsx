import type { TeactNode } from '@teact';
import { memo, useMemo } from '@teact';
import { getActions, withGlobal } from '../../../../global';

import type { AIProvider } from '../../../agent/types';

import {
  selectIsTelebizAgentConnected,
  selectIsTelebizClaudeConnected,
  selectIsTelebizGeminiConnected,
  selectIsTelebizOpenAIConnected,
  selectTelebizAgentActiveProvider,
} from '../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';

import useLastCallback from '../../../../hooks/useLastCallback';

import DropdownMenu from '../../../../components/ui/DropdownMenu';
import MenuItem from '../../../../components/ui/MenuItem';

import styles from './TelebizPanelHeader.module.scss';

interface ProviderInfo {
  id: AIProvider;
  name: string;
  icon: string;
}

const PROVIDERS: ProviderInfo[] = [
  { id: 'openrouter', name: 'OpenRouter', icon: '/providers/openrouter.svg' },
  { id: 'claude', name: 'Claude', icon: '/providers/claude.svg' },
  { id: 'openai', name: 'OpenAI', icon: '/providers/openai.svg' },
  { id: 'gemini', name: 'Gemini', icon: '/providers/gemini.svg' },
];

type StateProps = {
  activeProvider: AIProvider;
  isOpenRouterConnected: boolean;
  isClaudeConnected: boolean;
  isOpenAIConnected: boolean;
  isGeminiConnected: boolean;
};

const AIProviderSwitcher = ({
  activeProvider,
  isOpenRouterConnected,
  isClaudeConnected,
  isOpenAIConnected,
  isGeminiConnected,
}: StateProps) => {
  const { setTelebizActiveProvider } = getActions();

  const handleProviderSwitch = useLastCallback((provider: AIProvider) => {
    setTelebizActiveProvider({ provider });
  });

  const connectedProviders = useMemo(() => {
    const connected: Record<AIProvider, boolean> = {
      openrouter: isOpenRouterConnected,
      claude: isClaudeConnected,
      openai: isOpenAIConnected,
      gemini: isGeminiConnected,
    };
    return PROVIDERS.filter((p) => connected[p.id]);
  }, [isOpenRouterConnected, isClaudeConnected, isOpenAIConnected, isGeminiConnected]);

  const currentProvider = useMemo(() => {
    return PROVIDERS.find((p) => p.id === activeProvider) || PROVIDERS[0];
  }, [activeProvider]);

  // Don't render if only one or no providers connected
  if (connectedProviders.length <= 1) {
    return undefined;
  }

  const ProviderMenuButton = useMemo(() => {
    return ({ onTrigger, isOpen }: { onTrigger: () => void; isOpen?: boolean }): TeactNode => (
      <div
        className={buildClassName(styles.providerSwitcher, isOpen && styles.providerSwitcherOpen)}
        onClick={onTrigger}
      >
        <img
          src={currentProvider.icon}
          alt={currentProvider.name}
          className={styles.providerSwitcherIcon}
        />
      </div>
    );
  }, [currentProvider]);

  return (
    <DropdownMenu
      trigger={ProviderMenuButton}
      positionX="right"
      positionY="top"
    >
      {connectedProviders.map((provider) => (
        <MenuItem
          key={provider.id}
          onClick={() => handleProviderSwitch(provider.id)}
          className={buildClassName(
            styles.providerMenuItem,
            provider.id === activeProvider && styles.providerMenuItemActive,
          )}
        >
          <img
            src={provider.icon}
            alt={provider.name}
            className={styles.providerMenuItemIcon}
          />
          <span>{provider.name}</span>
        </MenuItem>
      ))}
    </DropdownMenu>
  );
};

export default memo(withGlobal((global): Complete<StateProps> => {
  return {
    activeProvider: selectTelebizAgentActiveProvider(global),
    isOpenRouterConnected: selectIsTelebizAgentConnected(global),
    isClaudeConnected: selectIsTelebizClaudeConnected(global),
    isOpenAIConnected: selectIsTelebizOpenAIConnected(global),
    isGeminiConnected: selectIsTelebizGeminiConnected(global),
  };
})(AIProviderSwitcher));
