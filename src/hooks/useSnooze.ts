type TSnoozeProps = {
  chatId: string;
  topicId?: number;
};

export default function useSnooze() {
  const snooze = (props?: TSnoozeProps) => {
    const { chatId, topicId } = props || {};
    // eslint-disable-next-line no-console
    console.log('snooze', chatId, topicId);
  };

  return { snooze };
}
