const DEFAULT_MAX_TEXT_LENGTH = 30;

export default function trimText(text: string | undefined, length = DEFAULT_MAX_TEXT_LENGTH) {
  if (!text || text.length <= length) {
    return text;
  }

  return `${text.substr(0, length)}...`;
}
