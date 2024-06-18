const TRIM_UNQUOTE = /^\s*"\s*|\s*";?\s*$/g;
const BACKSLASH_UNESCAPE = /(?:\\(.))/g;

export default function readStrings(data: string): Record<string, string> {
  const lines = data.split('\n');
  const result: Record<string, string> = {};
  for (const line of lines) {
    if (!line.startsWith('"')) continue;
    const [key, value] = parseLine(line) || [];
    if (!key || !value) {
      // eslint-disable-next-line no-console
      console.warn('Bad formatting in line:', line);
      continue;
    }
    result[key] = value;
  }
  return result;
}

function parseLine(line: string) {
  let isEscaped = false;
  let isInsideString = false;

  let separatorIndex;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '\\') {
      isEscaped = !isEscaped;
      continue;
    }

    if (char === '"' && !isEscaped) {
      isInsideString = !isInsideString;
      continue;
    }

    if (char === '=' && !isInsideString) {
      separatorIndex = i;
      break;
    }

    isEscaped = false;
  }

  if (separatorIndex === undefined || separatorIndex === line.length - 1) return undefined;

  const key = line
    .slice(0, separatorIndex)
    .replace(TRIM_UNQUOTE, '')
    .replace(BACKSLASH_UNESCAPE, '$1');
  const value = line
    .slice(separatorIndex + 1)
    .replace(TRIM_UNQUOTE, '')
    .replace(BACKSLASH_UNESCAPE, '$1');

  return [key, value];
}
