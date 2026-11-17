// What widgets keep outside the global state, by `getWidgetStorageKey`: `sessionStorage`, for this tab only, like a
// page's own (widget-sandbox sdk-v1 §5.4), and the `localStorage` of scheduled and ephemeral messages, which never
// reach the chat's history
export const widgetSessionStorages = new Map<string, Record<string, string>>();
export const widgetTransientLocalStorages = new Map<string, Record<string, string>>();

type StorageBinding = {
  // Writes the local area the widget still holds to the global state
  flush: NoneToVoidFunction;
  // Drops what the widget holds and starts it again
  reset: NoneToVoidFunction;
};

const bindings = new Set<StorageBinding>();

// Scheduled and ephemeral messages number their ids apart from the chat's history
export function getWidgetStorageKey(chatId: string, messageId: number, kind?: 'scheduled' | 'ephemeral') {
  return `${chatId}:${kind ? `${kind}:` : ''}${messageId}`;
}

export function bindWidgetStorage(binding: StorageBinding) {
  bindings.add(binding);
  return () => {
    bindings.delete(binding);
  };
}

export function flushWidgetStorage() {
  bindings.forEach(({ flush }) => flush());
}

// A running widget holds its storage and commits all of it: it must not write back what was cleared
export function clearWidgetStorage() {
  widgetSessionStorages.clear();
  widgetTransientLocalStorages.clear();
  bindings.forEach(({ reset }) => reset());
}

// A message that gets its server id keeps what its widget stored under the local one
export function moveWidgetStorage(fromKey: string, toKey: string) {
  [widgetSessionStorages, widgetTransientLocalStorages].forEach((storages) => {
    const values = storages.get(fromKey);
    if (!values) return;
    storages.delete(fromKey);
    storages.set(toKey, values);
  });
}
