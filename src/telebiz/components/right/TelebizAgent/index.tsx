import type { ChangeEvent, FormEvent } from 'react';
import type { FC } from '../../../../lib/teact/teact';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type {
  AgentConfig, AgentMessage as AgentMessageType, ConfirmationRequest, OpenRouterModel,
} from '../../../agent/types';
import { TelebizSettingsScreens } from '../../left/types';

import { requestForcedReflow, requestMutation } from '../../../../lib/fasterdom/fasterdom';
import {
  selectIsActiveProviderConnected,
  selectIsTelebizAgentConnecting,
  selectTelebizAgentConfig,
  selectTelebizAgentError,
  selectTelebizAgentIsLoadingModelsForActiveProvider,
  selectTelebizAgentIsRunning,
  selectTelebizAgentMessages,
  selectTelebizAgentMode,
  selectTelebizAgentModelsForActiveProvider,
  selectTelebizAgentPendingConfirmation,
  selectTelebizAgentThinking,
} from '../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';

import useLastCallback from '../../../../hooks/useLastCallback';
import { useTelebizLang } from '../../../hooks/useTelebizLang';
import useAgentMentionTooltip from './hooks/useAgentMentionTooltip';
import useAgentSkillTooltip from './hooks/useAgentSkillTooltip';

import MentionTooltip from '../../../../components/middle/composer/MentionTooltip';
import Button from '../../../../components/ui/Button';
import TextArea from '../../../../components/ui/TextArea';
import TelebizFeaturesList from '../../common/TelebizFeaturesList';
import AgentModalLogo from '../../icons/AgentModalLogo';
import NewAiChat from '../../icons/NewAiChat';
import AgentMessage from './AgentMessage';
import AgentPlanView from './AgentPlanView';
import AgentSettingSelector from './AgentSettingSelector';
import SkillTooltip from './SkillTooltip';
import ThinkingIndicator from './ThinkingIndicator';

import styles from './TelebizAgent.module.scss';

type AgentMode = 'agent' | 'ask' | 'plan';

const SUGGESTION_PROMPTS = [
  'List all chats I haven\'t messaged in the last week',
  'Summarize the current chat',
  'Add all groups containing "work" to a new folder',
  'Send "Happy holidays!" to all my pinned chats',
];

const MODES: { id: AgentMode; label: string; description: string }[] = [
  { id: 'ask', label: 'Ask', description: 'Chat without actions' },
  { id: 'plan', label: 'Plan', description: 'Create plan without executing' },
  { id: 'agent', label: 'Agent', description: 'Execute actions automatically' },
];

type StateProps = {
  isConnected: boolean;
  isConnecting: boolean;
  isRunning: boolean;
  messages: AgentMessageType[];
  pendingConfirmation?: ConfirmationRequest;
  error?: string;
  mode: AgentMode;
  config: AgentConfig;
  availableModels: OpenRouterModel[];
  isLoadingModels: boolean;
  thinking: {
    isThinking: boolean;
    startedAt?: number;
    currentStep?: string;
    steps: string[];
  };
};

const TelebizAgent: FC<StateProps> = ({
  isConnected,
  isConnecting,
  isRunning,
  messages,
  pendingConfirmation,
  error,
  mode,
  config,
  availableModels,
  isLoadingModels,
  thinking,
}) => {
  const lang = useTelebizLang();
  const {
    openTelebizSettingsScreen,
    openTelebizPanelScreen,
    telebizConnectOpenRouter,
    setTelebizAgentMode,
    updateTelebizAgentConfig,
    sendTelebizAgentMessage,
    confirmTelebizAgentPlan,
    cancelTelebizAgentPlan,
    stopTelebizAgentExecution,
    createAgentConversation,
  } = getActions();

  const [inputValue, setInputValue] = useState('');
  const messagesContainerRef = useRef<HTMLDivElement>();
  const messagesEndRef = useRef<HTMLDivElement>();
  const inputRef = useRef<HTMLTextAreaElement>();
  const shouldAutoScrollRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const isFirstRenderRef = useRef(true);

  const handleInsertMention = useLastCallback((beforeMention: string, username: string, afterMention: string) => {
    const newValue = beforeMention + username + afterMention;
    setInputValue(newValue);

    // Set cursor position after the inserted mention
    requestMutation(() => {
      const textarea = inputRef.current;
      if (textarea) {
        const newCursorPos = beforeMention.length + username.length;
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }
    });
  });

  const {
    isMentionTooltipOpen,
    closeMentionTooltip,
    insertMention,
    mentionFilteredUsers,
  } = useAgentMentionTooltip(
    isConnected,
    inputValue,
    inputRef,
    handleInsertMention,
  );

  const handleInsertSkill = useLastCallback((beforeSkill: string, skillTag: string, afterSkill: string) => {
    const newValue = beforeSkill + skillTag + afterSkill;
    setInputValue(newValue);

    // Set cursor position after the inserted skill tag
    requestMutation(() => {
      const textarea = inputRef.current;
      if (textarea) {
        const newCursorPos = beforeSkill.length + skillTag.length;
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }
    });
  });

  const {
    isSkillTooltipOpen,
    closeSkillTooltip,
    insertSkill,
    filteredSkills,
  } = useAgentSkillTooltip(
    isConnected,
    inputValue,
    inputRef,
    handleInsertSkill,
  );

  const checkIfAtBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    const threshold = 100;
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  }, []);

  const handleScroll = useCallback(() => {
    shouldAutoScrollRef.current = checkIfAtBottom();
  }, [checkIfAtBottom]);

  useEffect(() => {
    const isNewMessage = messages.length > prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;

    if (isNewMessage) {
      shouldAutoScrollRef.current = true;
    }

    if (shouldAutoScrollRef.current) {
      const behavior = isFirstRenderRef.current ? 'instant' : 'smooth';
      messagesEndRef.current?.scrollIntoView({ behavior });
      isFirstRenderRef.current = false;
    }
  }, [messages]);

  const handleInputChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  }, []);

  const handleSubmit = useCallback((e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed || isRunning) return;

    sendTelebizAgentMessage({ message: trimmed });
    setInputValue('');

    shouldAutoScrollRef.current = true;

    const textarea = inputRef.current;
    if (textarea) {
      requestMutation(() => {
        textarea.style.height = '0';
        requestForcedReflow(() => {
          const newHeight = textarea.scrollHeight;
          return () => {
            textarea.style.height = `${newHeight}px`;
          };
        });
      });
    }
  }, [inputValue, isRunning, sendTelebizAgentMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setInputValue(suggestion);
    inputRef.current?.focus();
  }, []);

  const handleConnect = useCallback(() => {
    telebizConnectOpenRouter();
  }, [telebizConnectOpenRouter]);

  const handleModelChange = useCallback((modelId: string) => {
    updateTelebizAgentConfig({ model: modelId });
  }, [updateTelebizAgentConfig]);

  const modelOptions = useMemo(() => {
    if (isLoadingModels) {
      return [{ id: config.model, label: 'Loading...', description: 'Loading models' }];
    }
    if (availableModels.length === 0) {
      return [{ id: config.model, label: 'No models', description: 'No models available' }];
    }
    return availableModels.map((model) => {
      let label = model.name || model.id.split('/').pop()?.replace(/-/g, ' ') || model.id;
      const colonIndex = label.indexOf(':');
      if (colonIndex !== -1) {
        label = label.substring(colonIndex + 1).trim();
      }
      const promptPrice = model.pricing?.prompt ? (model.pricing.prompt * 1000000).toFixed(2) : '';
      const description = promptPrice ? `$${promptPrice}/M` : '';
      return {
        id: model.id,
        label,
        badge: promptPrice ? <span className={styles.price}>{`$${promptPrice}/M`}</span> : undefined,
        description,
      };
    });
  }, [availableModels, isLoadingModels, config.model]);

  if (!isConnected) {
    return (
      <div className={styles.container}>
        <div className={styles.setupRequired}>
          <div className={styles.setupIcon}>
            <AgentModalLogo />
          </div>
          <h3>{lang('Agent.SetupRequired')}</h3>
          <p>{lang('Agent.SetupDescription')}</p>
          <button
            type="button"
            className={styles.setupButton}
            onClick={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? lang('Agent.Connecting') : lang('Agent.ConnectOpenRouter')}
          </button>

          {error && (
            <div className={styles.setupError}>
              <span>{error}</span>
            </div>
          )}
        </div>
        <div className={styles.featurePromoContainer}>
          {/* Features List */}
          <TelebizFeaturesList
            showWelcome
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div
        ref={messagesContainerRef}
        className={buildClassName(styles.messagesContainer, 'custom-scroll')}
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.icon}>
              <AgentModalLogo />
            </div>
            <h3>{lang('Agent.Welcome')}</h3>
            <p>{lang('Agent.WelcomeDescription')}</p>
            <div className={styles.suggestions}>
              {SUGGESTION_PROMPTS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className={styles.suggestionButton}
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <AgentMessage key={message.id} message={message} />
            ))}

            {pendingConfirmation && (
              <AgentPlanView
                confirmation={pendingConfirmation}
                isExecuting={isRunning}
                onConfirm={confirmTelebizAgentPlan}
                onCancel={cancelTelebizAgentPlan}
              />
            )}

            {isRunning && !pendingConfirmation && (
              <ThinkingIndicator thinking={thinking} />
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className={styles.inputContainer}>
        <MentionTooltip
          isOpen={isMentionTooltipOpen}
          onClose={closeMentionTooltip}
          onInsertUserName={insertMention}
          filteredUsers={mentionFilteredUsers}
        />
        <SkillTooltip
          isOpen={isSkillTooltipOpen}
          onClose={closeSkillTooltip}
          onSelectSkill={insertSkill}
          filteredSkills={filteredSkills}
        />
        <form onSubmit={handleSubmit}>
          <div className={buildClassName(
            styles.inputWrapper,
            !isConnected && styles.disabled,
          )}
          >
            <TextArea
              ref={inputRef}
              value={inputValue}
              className={styles.input}
              onChange={handleInputChange}
              disabled={!isConnected}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === 'agent' ? 'What would you like me to do?'
                  : mode === 'ask' ? 'Ask a question...'
                    : 'Describe what you want to plan...'
              }
            />
            <Button
              round
              color="translucent"
              className={styles.sendButton}
              onClick={isRunning ? () => stopTelebizAgentExecution() : handleSubmit}
              disabled={!isConnected || (!isRunning && !inputValue.trim())}
              iconName={isRunning ? 'stop' : 'send'}
            />
          </div>
        </form>
        <div className={styles.inputToolbar}>
          <AgentSettingSelector
            options={MODES}
            selected={mode}
            onChange={(newMode) => setTelebizAgentMode({ mode: newMode.id as AgentMode })}
            disabled={isRunning}
          />
          <AgentSettingSelector
            options={modelOptions}
            selected={config.model}
            onChange={(option) => handleModelChange(option.id)}
            disabled={isRunning || isLoadingModels}
          />
          <div className={styles.inputToolbarButtons}>
            {messages.length > 0 && (
              <Button
                round
                size="tiny"
                color="translucent"
                onClick={() => createAgentConversation()}
                ariaLabel="New chat"
              >
                <NewAiChat />
              </Button>
            )}
            <Button
              round
              size="tiny"
              color="translucent"
              onClick={() => openTelebizSettingsScreen({ screen: TelebizSettingsScreens.CustomSkills })}
              ariaLabel="Custom Skills"
              iconName="folder"
            />
            <Button
              round
              size="tiny"
              color="translucent"
              onClick={() => openTelebizSettingsScreen({ screen: TelebizSettingsScreens.OpenRouterIntegration })}
              ariaLabel="Settings"
              iconName="tools"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(withGlobal(
  (global): Complete<StateProps> => ({
    isConnected: selectIsActiveProviderConnected(global),
    isConnecting: selectIsTelebizAgentConnecting(global),
    isRunning: selectTelebizAgentIsRunning(global),
    messages: selectTelebizAgentMessages(global),
    pendingConfirmation: selectTelebizAgentPendingConfirmation(global),
    error: selectTelebizAgentError(global),
    mode: selectTelebizAgentMode(global),
    config: selectTelebizAgentConfig(global),
    availableModels: selectTelebizAgentModelsForActiveProvider(global),
    isLoadingModels: selectTelebizAgentIsLoadingModelsForActiveProvider(global),
    thinking: selectTelebizAgentThinking(global),
  }),
)(TelebizAgent));
