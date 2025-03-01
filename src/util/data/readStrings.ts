import { DEBUG } from '../../config';

export default function readStrings(data: string): Record<string, string> {
  const lines = data.split(/;\r?\n?/);
  const result: Record<string, string> = {};
  for (const line of lines) {
    if (!line.startsWith('"')) continue;
    const [key, value] = parseLine(line) || [];
    if (!key || !value) {
      // eslint-disable-next-line no-console
      console.warn('Bad formatting in line:', line);
      continue;
    }
    if (result[key]) {
      // eslint-disable-next-line no-console
      console.warn('Duplicate key:', key);
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

  try {
    const key = JSON.parse(line.slice(0, separatorIndex));
    const value = JSON.parse(line.slice(separatorIndex + 1));

    return [key, value];
  } catch (e) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error('Error parsing line:', line, e);
    }
  }

  return undefined;
}
