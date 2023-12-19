import { useEffect } from '../lib/teact/teact';

type TCommand = (
  | 'NEW_CHANNEL'
  | 'NEW_GROUP'
  | 'NEW_MEET'
  | 'NEW_FOLDER'
  | 'NEW_LINEAR_TASK'
  | 'OPEN_SEARCH'
  | 'OPEN_CHAT_SEARCH'
  | 'OPEN_SETTINGS'
  | 'OPEN_ARCHIVED'
  | 'OPEN_INBOX'
  | 'OPEN_SAVED'
  | 'LOCK_SCREEN'
  | 'OPEN_WORKSPACE_SETTINGS'
  | 'OPEN_AUTOMATION_SETTINGS'
);

export default function useCommands() {
  const runCommand = (command: TCommand, detail?: any) => {
    const event = new CustomEvent(command, { detail });
    document.dispatchEvent(event);
  };

  const useCommand = (command: TCommand, callback: (detail: any) => void) => {
    useEffect(() => {
      const listener = (event: CustomEvent) => { callback(event.detail); };
      document.addEventListener(command, listener as EventListener);
      return () => document.removeEventListener(command, listener as EventListener);
    }, [command, callback]);
  };

  return {
    useCommand,
    runCommand,
  };
}
