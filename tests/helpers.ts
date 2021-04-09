export function getMessageElement(messageId: number) {
  return document.getElementById(`message${messageId}`) as HTMLDivElement;
}
