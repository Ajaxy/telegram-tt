let RE_NOT_LETTER: RegExp;

try {
  RE_NOT_LETTER = /[^\p{L}\p{M}]+/ui;
} catch (e) {
  // Support for older versions of firefox
  RE_NOT_LETTER = /[^\wа-яёґєії]+/i;
}

export default function searchWords(haystack: string, needle: string | string[]) {
  if (!haystack || !needle) {
    return false;
  }

  const needleWords = typeof needle === 'string' ? needle.toLowerCase().split(RE_NOT_LETTER) : needle;
  const haystackLower = haystack.toLowerCase();

  // @optimization
  if (needleWords.length === 1 && !haystackLower.includes(needleWords[0])) {
    return false;
  }

  let haystackWords: string[];

  return needleWords.every((needleWord) => {
    if (!haystackLower.includes(needleWord)) {
      return false;
    }

    if (!haystackWords) {
      haystackWords = haystackLower.split(RE_NOT_LETTER);
    }

    return haystackWords.some((haystackWord) => haystackWord.startsWith(needleWord));
  });
}

export function prepareSearchWordsForNeedle(needle: string) {
  const needleWords = needle.toLowerCase().split(RE_NOT_LETTER);

  return (haystack: string) => searchWords(haystack, needleWords);
}
