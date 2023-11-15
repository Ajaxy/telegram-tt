import { useEffect } from '../lib/teact/teact';

type TCommand = (
  | 'NEW_CHANNEL'
  | 'NEW_GROUP'
  | 'NEW_FOLDER'
  | 'OPEN_SEARCH'
  | 'OPEN_SETTINGS'
  | 'OPEN_ARCHIVED'
);

export default function useCommands() {
  const runCommand = (command: TCommand) => {
    document.dispatchEvent(new Event(command));
  };

  const useCommand = (command: TCommand, f: Function) => {
    useEffect(() => {
      const listener = () => { f(); };
      document.addEventListener(command, listener);
      return () => document.removeEventListener(command, listener);
    }, [command, f]);
  };

  return {
    useCommand,
    runCommand,
  };
}
