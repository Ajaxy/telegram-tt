let RE_NOT_LETTER: RegExp;

try {
  RE_NOT_LETTER = new RegExp('[^\\p{L}\\p{M}]+', 'ui');
} catch (e) {
  // Support for older versions of firefox
  RE_NOT_LETTER = new RegExp('[^\\wа-яё]+', 'i');
}

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
