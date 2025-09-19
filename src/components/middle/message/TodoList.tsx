import {
  memo, useLayoutEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type {
  ApiMediaTodo,
  ApiMessage,
  ApiPeer,
} from '../../../api/types';

import { getPeerFullTitle, getPeerTitle } from '../../../global/helpers/peers';
import { selectIsCurrentUserPremium, selectSender, selectUser } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { renderTextWithEntities } from '../../common/helpers/renderTextWithEntities';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import AnimatedCounter from '../../common/AnimatedCounter';
import Icon from '../../common/icons/Icon';
import CheckboxGroup from '../../ui/CheckboxGroup';

import './TodoList.scss';

type OwnProps = {
  message: ApiMessage;
  todoList: ApiMediaTodo;
};

type StateProps = {
  sender?: ApiPeer;
  isCurrentUserPremium: boolean;
  isSynced?: boolean;
};

const TodoList = ({
  message,
  todoList,
  sender,
  isCurrentUserPremium,
  isSynced,
}: OwnProps & StateProps) => {
  const { toggleTodoCompleted, showNotification, requestConfetti } = getActions();
  const { todo, completions } = todoList;
  const { title, items, othersCanComplete } = todo;
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const completedTasksSet = useMemo(() => new Set(completedTasks), [completedTasks]);

  const canToggle = !message.isScheduled && isCurrentUserPremium && isSynced;

  useLayoutEffect(() => {
    const completedIds = completions?.map((c) => c.itemId.toString()) || [];
    setCompletedTasks(completedIds);
  }, [completions]);

  const lang = useLang();

  const handleTaskLabelClick = useLastCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isCurrentUserPremium) {
      showNotification({
        message: lang('SubscribeToTelegramPremiumForToggleTask'),
        action: {
          action: 'openPremiumModal',
          payload: { initialSection: 'todo' },
        },
        actionText: lang('PremiumMore'),
      });
      return;
    }
  });

  const handleTaskToggle = useLastCallback((newCompletedTasks: string[]) => {
    const newCompletedId = newCompletedTasks.find((id) => !completedTasksSet.has(id));
    const newIncompletedId = Array.from(completedTasksSet).find((id) => !newCompletedTasks.includes(id));

    toggleTodoCompleted({
      chatId: message.chatId,
      messageId: message.id,
      completedIds: newCompletedId ? [Number(newCompletedId)] : [],
      incompletedIds: newIncompletedId ? [Number(newIncompletedId)] : [],
    });

    if (newCompletedTasks.length === items.length) {
      requestConfetti({});
    }
  });
  const isReadOnly = Boolean(message.forwardInfo) || (!othersCanComplete && !message.isOutgoing);
  const isOutgoing = message.isOutgoing;

  const tasks = useMemo(() => items.map((task) => {
    const user = !othersCanComplete ? undefined : selectUser(getGlobal(),
      completions?.find((c) => c.itemId === task.id)?.completedBy || '');
    const subLabel = user ? getPeerFullTitle(lang, user) : undefined;
    return {
      label: renderTextWithEntities(task.title),
      value: task.id.toString(),
      user,
      subLabel,
    };
  }), [items, othersCanComplete, completions, lang]);

  const renderCheckBoxGroup = () => {
    return (
      <CheckboxGroup
        options={tasks}
        selected={completedTasks}
        onChange={handleTaskToggle}
        onClickLabel={!isCurrentUserPremium ? handleTaskLabelClick : undefined}
        disabled={!canToggle}
        isRound
      />
    );
  };

  const renderReadOnlyTodoList = () => {
    return (
      <div className="todo-list-items">
        {tasks.map((task) => (
          <div
            key={task.value}
            className="todo-list-readonly-item"
          >
            <div className="todo-readonly-item-checkbox">
              {completedTasksSet.has(task.value)
                ? <Icon name="check" />
                : <div className="todo-item-bullet-point" />}
            </div>
            <div
              className={buildClassName(
                'readonly-item-label',
                completedTasksSet.has(task.value) && 'completed-label',
              )}
            >
              {task.label}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderTodoListType = () => {
    if (message.forwardInfo) {
      return lang('TitleToDoList');
    }

    if (othersCanComplete) {
      return lang('TitleGroupToDoList');
    }

    if (isOutgoing) {
      return lang('TitleYourToDoList');
    }

    if (sender) {
      return lang('TitleUserToDoList', { peer: getPeerTitle(lang, sender) }, { withNodes: true });
    }

    return lang('TitleToDoList');
  };

  return (
    <div className="todo-list" dir={lang.isRtl ? 'auto' : 'ltr'}>
      <div className="todo-list-header">
        <div className="todo-list-title">
          {renderTextWithEntities(title)}
        </div>
        <div className="list-type">
          {renderTodoListType()}
        </div>
      </div>

      <div className="todo-list-items">
        {isReadOnly ? renderReadOnlyTodoList() : renderCheckBoxGroup()}
      </div>
      <div className="completed-tasks-count">
        <AnimatedCounter text={
          lang('DescriptionCompletedToDoTasks', {
            number: completedTasks.length,
            count: tasks.length,
          })
        }
        />
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>((global, { message }): Complete<StateProps> => {
  const sender = selectSender(global, message);
  return {
    sender,
    isCurrentUserPremium: selectIsCurrentUserPremium(global),
    isSynced: global.isSynced,
  };
},
)(TodoList));
