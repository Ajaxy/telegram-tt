// @ts-nocheck
const replaceInFile = require('replace-in-file');
const langPackAndroid = require('./en-android.json');
const langPackIOs = require('./en-ios.json');
const langPackExtra = require('./en-extra.json');


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

(async () => {
  const androidByKey = prepareAndroidByKey();
  const extraByKey = langPackExtra;
  const newKeysByValue = prepareByValue(langPackIOs);

  await replaceInFile({
    files: ['./src/components/**/*.tsx', './src/modules/**/*.ts'],
    from: [
      /(?:lang|getTranslation)\('(\w+)'\)/g,
    ],
    to: (match: string, key: string) => {
      if (extraByKey[key]) {
        return match;
      }

      const value = androidByKey[key];
      const newKey = newKeysByValue[value.toLowerCase()];
      if (!newKey) {
        return match;
      }

      return match.replace(key, newKey);
    },
  });

  // eslint-disable-next-line no-console
  console.log('Cool!');
})();

function prepareAndroidByKey() {
  // Select the shortest key for each value
  return Object.keys(langPackAndroid).reduce((acc, key) => {
    acc[key] = langPackAndroid[key].value;
    return acc;
  }, {} as Pairs);
}


function prepareByValue(langPack: ApiLangPack) {
  // Get key arrays by values (only for single-value strings)
  const byValue = Object.values(langPack).reduce((acc, { value, key }) => {
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
