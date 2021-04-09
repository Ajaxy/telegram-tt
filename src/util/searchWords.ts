const RE_NOT_LETTER = /[^\wа-яё]+/;

export default function searchWords(haystack: string, needle: string) {
  if (!haystack || !needle) {
    return false;
  }

  const haystackWords = haystack.toLowerCase().split(RE_NOT_LETTER);
  const needleWords = needle.toLowerCase().split(RE_NOT_LETTER);

  return needleWords.every((needleWord) => (
    haystackWords.some((haystackWord) => haystackWord.startsWith(needleWord))
  ));
}
