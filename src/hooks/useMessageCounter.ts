import { useEffect, useState, useRef } from '../lib/teact/teact';
import { safeApiCall } from '../util/safeApiCall';
import { TaskQueue } from '../util/TaskQueue';

type MessageCounterStatus = 'idle' | 'queued' | 'processing' | 'completed';

interface MessageCounterState {
  count: number;
  isLoading: boolean;
  error: Error | null;
  isPaused: boolean;
  status: MessageCounterStatus;
}

interface MessageCounterOptions {
  chatId: string | number;
  isVisible?: boolean;
  priority?: number;
}

const taskQueue = new TaskQueue();

export function useMessageCounter({ chatId, isVisible = true, priority = 0 }: MessageCounterOptions): MessageCounterState {
  const [state, setState] = useState<MessageCounterState>({
    count: 0,
    isLoading: false,
    error: null,
    isPaused: !isVisible,
    status: 'idle',
  });

  const taskIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Если чат не виден, приостанавливаем подсчет
    if (!isVisible) {
      setState((prev: MessageCounterState) => ({ 
        ...prev, 
        isPaused: true,
        status: 'idle',
        isLoading: false
      }));
      return;
    }

    // Если чат стал видимым, возобновляем подсчет
    if (isVisible && state.isPaused) {
      setState((prev: MessageCounterState) => ({ 
        ...prev, 
        isPaused: false,
        status: 'queued',
        isLoading: true
      }));
    }

    // Если чат не виден или приостановлен, не начинаем подсчет
    if (!isVisible || state.isPaused) {
      return;
    }

    // Отменяем предыдущий запрос, если он есть
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Создаем новый контроллер для отмены
    abortControllerRef.current = new AbortController();

    // Добавляем задачу в очередь
    const taskId = taskQueue.addTask({
      execute: async () => {
        try {
          setState((prev: MessageCounterState) => ({ 
            ...prev, 
            isLoading: true, 
            error: null,
            status: 'processing'
          }));

          const result = await safeApiCall(
            async () => {
              // Здесь должен быть реальный вызов API для подсчета сообщений
              // Например: return await client.getMessagesCount(chatId);
              return Math.floor(Math.random() * 1000); // Временная заглушка для тестирования
            },
            `countMessages:${chatId}`,
          );

          setState((prev: MessageCounterState) => ({
            ...prev,
            count: typeof result === 'number' ? result : 0,
            isLoading: false,
            error: null,
            status: 'completed',
            isPaused: false
          }));
        } catch (error) {
          // Если запрос был отменен, не обновляем состояние
          if (error instanceof Error && error.name === 'AbortError') {
            return;
          }

          setState((prev: MessageCounterState) => ({
            ...prev,
            isLoading: false,
            error: error instanceof Error ? error : new Error('Failed to count messages'),
            status: 'completed',
            isPaused: false
          }));
        }
      },
      priority,
    });

    taskIdRef.current = taskId;
    
    // Обновляем статус на 'queued', когда задача добавлена в очередь
    setState((prev: MessageCounterState) => ({ 
      ...prev, 
      status: 'queued',
      isLoading: true,
      isPaused: false
    }));

    // Очистка при размонтировании
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      taskIdRef.current = null;
    };
  }, [chatId, isVisible, state.isPaused, priority]);

  // Проверяем результат задачи
  useEffect(() => {
    if (!taskIdRef.current) return;

    const result = taskQueue.getResult(taskIdRef.current);
    if (result?.error) {
      setState((prev: MessageCounterState) => ({
        ...prev,
        isLoading: false,
        error: result.error instanceof Error ? result.error : new Error('Unknown error'),
        status: 'completed',
        isPaused: false
      }));
    }
  }, [taskIdRef.current]);

  // Проверяем и нормализуем состояние перед возвратом
  return {
    ...state,
    count: typeof state.count === 'number' ? state.count : 0,
    isLoading: Boolean(state.isLoading),
    error: state.error instanceof Error ? state.error : null,
    isPaused: Boolean(state.isPaused),
    status: typeof state.status === 'string' && ['idle', 'queued', 'processing', 'completed'].includes(state.status)
      ? state.status as MessageCounterStatus
      : 'idle'
  };
} 