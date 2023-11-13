export default function useCommands() {
  const commandNewChannel = () => {};
  const commandNewGroup = () => {};
  const commandNewFolder = () => {};

  const onCommandNewChannel = (f: Function) => { f(); };
  const onCommandNewGroup = (f: Function) => { f(); };
  const onCommandNewFolder = (f: Function) => { f(); };

  return {
    commandNewChannel,
    commandNewGroup,
    commandNewFolder,
    onCommandNewChannel,
    onCommandNewGroup,
    onCommandNewFolder,
  };
}
