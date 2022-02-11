// @ts-nocheck
const replaceInFile = require('replace-in-file');
const langPackIOs = require('./en-ios.json');
const langPackExtra = require('./en-extra.json');

(async () => {
  const pairs = preparePairs();
  const pairs2 = preparePairs2();

  await replaceInFile({
    files: './src/components/**/*.tsx',
    from: [
      /(>[\r\n\s]*)([\w\-.?! ]+)([\r\n\s]*<)/gm,
      /(placeholder=)"([\w\-.?! ]+)"()/gm,
      /(label=)"([\w\-.?! ]+)"()/gm,
      /(ariaLabel=)"([\w\-.?! ]+)"()/gm,
      /(submitLabel=)"([\w\-.?! ]+)"()/gm,
    ],
    to: (match: string, p1: string, p2: string, p3: string) => {
      const trimmed = p2.trim().toLowerCase();

      if (pairs2[trimmed]) {
        return `${p1}{lang('${pairs2[trimmed]}')}${p3}`;
      } else if (pairs[trimmed]) {
        return `${p1}{lang('${pairs[trimmed]}')}${p3}`;
      } else {
        return match;
      }
    },
  });

  // eslint-disable-next-line no-console
  console.log('Cool!');
})();

interface ApiLangString {
  key: string;
  value?: string;
  zeroValue?: string;
  oneValue?: string;
  twoValue?: string;
  fewValue?: string;
  manyValue?: string;
  otherValue?: string;
}

type ApiLangPack = Record<string, ApiLangString>;

type ByValue = Record<string, string[]>;
type Pairs = Record<string, string>;

function preparePairs() {
  // Get key arrays by values (only for single-value strings)
  const byValue = Object.values(langPackIOs as ApiLangPack).reduce((acc, { value, key }) => {
    if (value) {
      value = value.toLowerCase();

      if (!acc[value]) {
        acc[value] = [key];
      } else {
        acc[value].push(key);
      }
    }

    return acc;
  }, {} as ByValue);

  // Select the shortest key for each value
  return Object.keys(byValue).reduce((acc, value) => {
    const keys = byValue[value];
    const shortestKeyLength = Math.min(...keys.map((k) => k.length));
    acc[value] = keys.find((k) => k.length === shortestKeyLength)!;
    return acc;
  }, {} as Pairs);
}

function preparePairs2() {
  return Object.keys(langPackExtra).reduce((acc, key) => {
    acc[langPackExtra[key].toLowerCase()] = key;
    return acc;
  }, {} as Pairs);
}
