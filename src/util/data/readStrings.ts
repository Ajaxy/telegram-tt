const IS_DEBUG = import.meta.env?.TG_APP_ENV !== 'production';

export default function readStrings(data: string, isStrict?: boolean): Record<string, string> {
  const report = (message: string) => {
    if (isStrict) throw new Error(message);
    // eslint-disable-next-line no-console
    console.warn(message);
  };

  const lines = data.split(/\r?\n/);
  const result: Record<string, string> = {};
  lines.forEach((rawLine, index) => {
    const line = rawLine.trimEnd();
    if (!line.startsWith('"')) return;
    if (!line.endsWith(';')) {
      report(`Missing semicolon in line ${index + 1}: ${line}`);
      return;
    }
    const [key, value] = parseLine(line.slice(0, -1)) || [];
    if (!key || !value) {
      report(`Bad formatting in line ${index + 1}: ${line}`);
      return;
    }
    if (result[key]) {
      report(`Duplicate key in line ${index + 1}: ${key}`);
    }
    result[key] = value;
  });
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
    if (IS_DEBUG) {
      // eslint-disable-next-line no-console
      console.error('Error parsing line:', line, e);
    }
  }

  return undefined;
}
