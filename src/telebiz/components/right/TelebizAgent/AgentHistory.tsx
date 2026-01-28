import { memo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { MenuItemContextAction } from '../../../../components/ui/ListItem';
import type { AgentConversation, AIProvider } from '../../../agent/types';
import { TelebizPanelScreens } from '../types';

import {
  selectTelebizAgentConversationsList,
  selectTelebizAgentCurrentConversationId,
} from '../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { formatPastTimeShort } from '../../../../util/dates/dateFormat';

import useLastCallback from '../../../../hooks/useLastCallback';
import useOldLang from '../../../../hooks/useOldLang';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import Icon from '../../../../components/common/icons/Icon';
import ListItem from '../../../../components/ui/ListItem';

import styles from './AgentHistory.module.scss';

const PROVIDER_ICONS: Record<AIProvider, string> = {
  openrouter: '/providers/openrouter.svg',
  claude: '/providers/claude.svg',
  openai: '/providers/openai.svg',
  gemini: '/providers/gemini.svg',
};

type StateProps = {
  conversations: AgentConversation[];
  currentConversationId?: string;
};

const AgentHistory = ({ conversations, currentConversationId }: StateProps) => {
  const lang = useTelebizLang();
  const oldLang = useOldLang();
  const {
    switchAgentConversation,
    deleteAgentConversation,
    openTelebizPanelScreen,
  } = getActions();

  const handleSelectConversation = useLastCallback((e: React.MouseEvent, conversationId: string) => {
    switchAgentConversation({ conversationId });
    openTelebizPanelScreen({ screen: TelebizPanelScreens.AgentMode });
  });

  const handleDeleteConversation = useLastCallback((conversationId: string) => {
    deleteAgentConversation({ conversationId });
  });

  if (conversations.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <Icon name="comments" />
          </div>
          <h3>{lang('Agent.History.Empty')}</h3>
          <p>{lang('Agent.History.EmptyDescription')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={buildClassName(styles.content, 'custom-scroll')}>
        {conversations.map((conversation) => {
          const messageCount = conversation.messages.filter((m) => m.role === 'user' || m.role === 'assistant').length;
          const isActive = conversation.id === currentConversationId;

          const contextActions: MenuItemContextAction[] = [
            {
              title: lang('Agent.History.Delete'),
              icon: 'delete',
              destructive: true,
              handler: () => handleDeleteConversation(conversation.id),
            },
          ];

          // Default to openrouter for backward compatibility
          const provider = conversation.provider || 'openrouter';
          const providerIcon = PROVIDER_ICONS[provider];

          return (
            <ListItem
              key={conversation.id}
              className={styles.conversationItem}
              buttonClassName={isActive ? styles.active : undefined}
              leftElement={(
                <div className={styles.providerIcon}>
                  <img src={providerIcon} alt={provider} />
                </div>
              )}
              multiline
              ripple
              contextActions={contextActions}
              withPortalForMenu
              onClick={handleSelectConversation}
              clickArg={conversation.id}
            >
              <span className={styles.conversationTitle}>
                {conversation.title || 'New Conversation'}
              </span>
              <span className={styles.conversationMeta}>
                {formatPastTimeShort(oldLang, conversation.createdAt)}
                {' • '}
                {messageCount}
                {' '}
                {lang('Agent.History.Messages')}
              </span>
            </ListItem>
          );
        })}
      </div>
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => ({
    conversations: selectTelebizAgentConversationsList(global),
    currentConversationId: selectTelebizAgentCurrentConversationId(global),
  }),
)(AgentHistory));
