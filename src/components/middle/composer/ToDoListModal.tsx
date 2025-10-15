import type { ChangeEvent } from 'react';
import type { ElementRef } from '../../../lib/teact/teact';
import {
  memo, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiNewMediaTodo } from '../../../api/types';
import type { ApiMessage } from '../../../api/types';
import type { TabState } from '../../../global/types/tabState';

import { requestMeasure, requestNextMutation } from '../../../lib/fasterdom/fasterdom';
import { selectChatMessage } from '../../../global/selectors';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import { generateUniqueNumberId } from '../../../util/generateUniqueId';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';

import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import Checkbox from '../../ui/Checkbox';
import InputText from '../../ui/InputText';
import Modal from '../../ui/Modal';

import './ToDoListModal.scss';

export type OwnProps = {
  modal: TabState['todoListModal'];
  onSend: (todoList: ApiNewMediaTodo) => void;
  onClear: () => void;
};

export type StateProps = {
  editingMessage?: ApiMessage;
  maxItemsCount: number;
  maxTitleLength: number;
  maxItemLength: number;
};

type Item = {
  id: number;
  text: string;
  isDisabled?: boolean;
};

const MAX_LIST_HEIGHT = 320;
const MAX_OPTION_LENGTH = 100;

const ToDoListModal = ({
  modal,
  maxItemsCount,
  maxTitleLength,
  maxItemLength,
  editingMessage,
  onSend,
  onClear,
}: OwnProps & StateProps) => {
  const { editTodo, closeTodoListModal, appendTodoList } = getActions();

  const titleInputRef = useRef<HTMLInputElement>();
  const itemsListRef = useRef<HTMLDivElement>();

  const [title, setTitle] = useState<string>('');
  const [items, setItems] = useState<Item[]>(() => [{ id: generateUniqueNumberId(), text: '' }]);
  const [isOthersCanAppend, setIsOthersCanAppend] = useState(true);
  const [isOthersCanComplete, setIsOthersCanComplete] = useState(true);
  const [hasErrors, setHasErrors] = useState<boolean>(false);

  const lang = useLang();

  const isOpen = Boolean(modal);
  const renderingModal = useCurrentOrPrev(modal);
  // Treat "Add task" as edit mode for own checklists
  const isAddTaskMode = renderingModal?.forNewTask && !editingMessage?.isOutgoing;

  const editingTodo = editingMessage?.content.todo?.todo;

  const frozenTasks = useMemo(() => {
    if (!isAddTaskMode || !editingTodo) {
      return MEMO_EMPTY_ARRAY;
    }

    return editingTodo.items.map((item) => ({
      id: item.id,
      text: item.title.text,
      isDisabled: true,
    }));
  }, [isAddTaskMode, editingTodo]);

  const focusInput = useLastCallback((ref: ElementRef<HTMLInputElement>) => {
    if (isOpen && ref.current) {
      ref.current.focus();
    }
  });

  useLayoutEffect(() => {
    if (editingTodo) {
      setTitle(editingTodo.title.text);
      setIsOthersCanAppend(editingTodo.othersCanAppend ?? false);
      setIsOthersCanComplete(editingTodo.othersCanComplete ?? false);
      if (!isAddTaskMode) {
        const editingItems = editingTodo.items.map((item) => ({
          id: item.id,
          text: item.title.text,
        }));
        if (editingItems.length < maxItemsCount) {
          editingItems.push({ id: generateUniqueNumberId(), text: '' });
        }
        setItems(editingItems);
      }
    }
  }, [editingTodo, isAddTaskMode, maxItemsCount]);

  useEffect(() => (isOpen ? captureEscKeyListener(onClear) : undefined), [isOpen, onClear]);
  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setItems([{ id: generateUniqueNumberId(), text: '' }]);
      setIsOthersCanAppend(true);
      setIsOthersCanComplete(true);
      setHasErrors(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      // Wait for the DOM to be updated
      requestMeasure(() => {
        if (renderingModal?.forNewTask) {
          const inputs = itemsListRef.current?.querySelectorAll('input');
          const lastInput = inputs?.[inputs.length - 1];
          lastInput?.focus();
        } else {
          focusInput(titleInputRef);
        }
      });
    }
  }, [focusInput, isOpen, renderingModal?.forNewTask]);

  const addNewItem = useLastCallback((newItems: Item[]) => {
    const id = generateUniqueNumberId();
    setItems([...newItems, { id, text: '' }]);

    requestNextMutation(() => {
      const list = itemsListRef.current;
      if (!list) {
        return;
      }

      requestMeasure(() => {
        list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
      });
    });
  });

  const handleCreate = useLastCallback(() => {
    setHasErrors(false);
    if (!isOpen) {
      return;
    }

    const todoItems = items
      .map((item) => {
        const text = item.text.trim();

        if (!text) return undefined;

        return {
          id: item.id,
          title: {
            text: text.substring(0, maxItemLength),
          },
        };
      }).filter(Boolean);

    const titleTrimmed = title.trim().substring(0, maxTitleLength);
    if (!titleTrimmed || todoItems.length === 0) {
      setTitle(titleTrimmed);
      if (todoItems.length) {
        const itemsTrimmed = items.map((o) => (
          { ...o, text: o.text.trim().substring(0, maxItemLength) }))
          .filter((o) => o.text.length);
        if (itemsTrimmed.length === 0) {
          addNewItem([]);
        } else {
          setItems([...itemsTrimmed, { id: generateUniqueNumberId(), text: '' }]);
        }
      } else {
        addNewItem([]);
      }
      setHasErrors(true);
      return;
    }

    if (isAddTaskMode && editingMessage) {
      appendTodoList({
        chatId: editingMessage.chatId,
        messageId: editingMessage.id,
        items: todoItems,
      });
      closeTodoListModal();
      return;
    }

    const payload: ApiNewMediaTodo = {
      todo: {
        title: {
          text: titleTrimmed,
        },
        items: todoItems,
        othersCanAppend: isOthersCanAppend,
        othersCanComplete: isOthersCanComplete,
      },
    };

    if (editingMessage) {
      editTodo({
        chatId: editingMessage.chatId,
        todo: payload,
        messageId: editingMessage.id,
      });
    } else {
      onSend(payload);
    }

    closeTodoListModal();
  });

  const updateItem = useLastCallback((index: number, text: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], text };
    if (newItems[newItems.length - 1].text.trim().length && newItems.length < maxItemsCount) {
      addNewItem(newItems);
    } else {
      setItems(newItems);
    }
  });

  const removeItem = useLastCallback((index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);

    requestNextMutation(() => {
      if (!itemsListRef.current) {
        return;
      }

      itemsListRef.current.classList.toggle('overflown', itemsListRef.current.scrollHeight > MAX_LIST_HEIGHT);
    });
  });

  const handleIsOthersCanAppendChange = useLastCallback((e: ChangeEvent<HTMLInputElement>) => {
    setIsOthersCanAppend(e.target.checked);
  });
  const handleIsOthersCanCompleteChange = useLastCallback((e: ChangeEvent<HTMLInputElement>) => {
    setIsOthersCanComplete(e.target.checked);
  });

  const handleKeyPress = useLastCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreate();
    }
  });

  const handleTitleChange = useLastCallback((e: ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  });

  const getTitleError = useLastCallback(() => {
    if (hasErrors && !title.trim().length) {
      return lang('ToDoListErrorChooseTitle');
    }

    return undefined;
  });

  const getItemsError = useLastCallback((index: number) => {
    const itemsTrimmed = items.map((o) => o.text.trim()).filter((o) => o.length);
    if (hasErrors && itemsTrimmed.length < 1 && !items[index].text.trim().length) {
      return lang('ToDoListErrorChooseTasks');
    }
    return undefined;
  });

  function renderHeader() {
    const modalTitle = isAddTaskMode ? 'TitleAppendToDoList'
      : editingMessage ? 'TitleEditToDoList' : 'TitleNewToDoList';
    return (
      <div className="modal-header-condensed">
        <Button round color="translucent" size="smaller" ariaLabel={lang('AriaToDoCancel')} onClick={onClear}>
          <Icon name="close" />
        </Button>
        <div className="modal-title">{lang(modalTitle)}</div>
        <Button
          color="primary"
          size="smaller"
          className="modal-action-button"
          onClick={handleCreate}
        >
          {lang(isAddTaskMode ? 'Add' : editingMessage ? 'Save' : 'Create')}
        </Button>
      </div>
    );
  }

  function renderItems() {
    const tasksToRender = [...frozenTasks, ...items];
    return tasksToRender.map((item, index) => {
      const stateIndex = index - frozenTasks.length;
      return (
        <div className="item-wrapper">
          <InputText
            maxLength={MAX_OPTION_LENGTH}
            label={index !== tasksToRender.length - 1 || tasksToRender.length === maxItemsCount
              ? lang('TitleTask')
              : lang('TitleAddTask')}
            error={getItemsError(stateIndex)}
            value={item.text}
            disabled={item.isDisabled}
            onChange={(e) => updateItem(stateIndex, e.currentTarget.value)}
            onKeyPress={handleKeyPress}
          />
          {index !== tasksToRender.length - 1 && !item.isDisabled && (
            <Button
              className="item-remove-button"
              round
              color="translucent"
              size="smaller"
              ariaLabel={lang('Delete')}
              onClick={() => removeItem(stateIndex)}
            >
              <Icon name="close" />
            </Button>
          )}
        </div>
      );
    });
  }

  const moreTasksCount = maxItemsCount - items.length - (isAddTaskMode && editingTodo ? editingTodo.items.length : 0);

  return (
    <Modal isOpen={isOpen} onClose={onClear} header={renderHeader()} className="ToDoListModal">
      {!isAddTaskMode && (
        <InputText
          ref={titleInputRef}
          label={lang('InputTitle')}
          value={title}
          error={getTitleError()}
          onChange={handleTitleChange}
          onKeyPress={handleKeyPress}
        />
      )}
      {isAddTaskMode && (
        <div className="readonly-title">
          {title}
        </div>
      )}
      <div className="options-divider" />

      <div className="options-list custom-scroll" ref={itemsListRef}>
        <h3 className="items-header">
          {lang('TitleToDoList')}
        </h3>

        {renderItems()}

      </div>

      <div className="items-count-hint">
        {lang('HintTodoListTasksCount2', {
          count: moreTasksCount,
        }, {
          pluralValue: moreTasksCount,
        })}
      </div>

      <div className="options-divider" />

      {!isAddTaskMode && (
        <div className="options-footer">
          <div className="dialog-checkbox-group">
            <Checkbox
              label={lang('AllowOthersAddTasks')}
              checked={isOthersCanAppend}
              onChange={handleIsOthersCanAppendChange}
            />
            <Checkbox
              label={lang('AllowOthersMarkAsDone')}
              checked={isOthersCanComplete}
              onChange={handleIsOthersCanCompleteChange}
            />
          </div>
        </div>
      )}
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => {
    const { appConfig } = global;
    const editingMessage = modal?.messageId ? selectChatMessage(global, modal.chatId, modal.messageId) : undefined;
    return {
      editingMessage,
      maxItemsCount: appConfig.todoItemsMax,
      maxTitleLength: appConfig.todoTitleLengthMax,
      maxItemLength: appConfig.todoItemLengthMax,
    };
  },
)(ToDoListModal));
