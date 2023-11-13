export default function useSnooze() {
  const snoozeCurrentChat = () => {
    // eslint-disable-next-line no-console
    console.log('snoozeCurrentChat');
  };

  const snoozeChat = ({ id }: { id: string }) => {
    // eslint-disable-next-line no-console
    console.log('snoozeChat', id);
  };

  return { snoozeCurrentChat, snoozeChat };
}
