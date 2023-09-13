import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ISettings } from '../../../types';
import type { IRadioOption } from '../../ui/CheckboxGroup';

import { SUPPORTED_TRANSLATION_LANGUAGES } from '../../../config';
import buildClassName from '../../../util/buildClassName';
import { partition, unique } from '../../../util/iteratees';

import useEffectWithPrevDeps from '../../../hooks/useEffectWithPrevDeps';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';

import Checkbox from '../../ui/Checkbox';
import InputText from '../../ui/InputText';

import styles from './SettingsDoNotTranslate.module.scss';

// https://fasttext.cc/docs/en/language-identification.html
const LOCAL_SUPPORTED_DETECTION_LANGUAGES = [
  'af', 'als', 'am', 'an', 'ar', 'arz', 'as', 'ast', 'av', 'az',
  'azb', 'ba', 'bar', 'bcl', 'be', 'bg', 'bh', 'bn', 'bo', 'bpy',
  'br', 'bs', 'bxr', 'ca', 'cbk', 'ce', 'ceb', 'ckb', 'co', 'cs',
  'cv', 'cy', 'da', 'de', 'diq', 'dsb', 'dty', 'dv', 'el', 'eml',
  'en', 'eo', 'es', 'et', 'eu', 'fa', 'fi', 'fr', 'frr', 'fy',
  'ga', 'gd', 'gl', 'gn', 'gom', 'gu', 'gv', 'he', 'hi', 'hif',
  'hr', 'hsb', 'ht', 'hu', 'hy', 'ia', 'id', 'ie', 'ilo', 'io',
  'is', 'it', 'ja', 'jbo', 'jv', 'ka', 'kk', 'km', 'kn', 'ko',
  'krc', 'ku', 'kv', 'kw', 'ky', 'la', 'lb', 'lez', 'li', 'lmo',
  'lo', 'lrc', 'lt', 'lv', 'mai', 'mg', 'mhr', 'min', 'mk', 'ml',
  'mn', 'mr', 'mrj', 'ms', 'mt', 'mwl', 'my', 'myv', 'mzn', 'nah',
  'nap', 'nds', 'ne', 'new', 'nl', 'nn', 'no', 'oc', 'or', 'os',
  'pa', 'pam', 'pfl', 'pl', 'pms', 'pnb', 'ps', 'pt', 'qu', 'rm',
  'ro', 'ru', 'rue', 'sa', 'sah', 'sc', 'scn', 'sco', 'sd', 'sh',
  'si', 'sk', 'sl', 'so', 'sq', 'sr', 'su', 'sv', 'sw', 'ta', 'te',
  'tg', 'th', 'tk', 'tl', 'tr', 'tt', 'tyv', 'ug', 'uk', 'ur', 'uz',
  'vec', 'vep', 'vi', 'vls', 'vo', 'wa', 'war', 'wuu', 'xal', 'xmf',
  'yi', 'yo', 'yue', 'zh',
];

const SUPPORTED_LANGUAGES = SUPPORTED_TRANSLATION_LANGUAGES.filter((lang: string) => (
  LOCAL_SUPPORTED_DETECTION_LANGUAGES.includes(lang)
));

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = Pick<ISettings, 'language' | 'doNotTranslate'>;

const SettingsDoNotTranslate: FC<OwnProps & StateProps> = ({
  isActive,
  language,
  doNotTranslate,
  onReset,
}) => {
  const { setSettingOption } = getActions();

  const lang = useLang();
  const [displayedOptions, setDisplayedOptions] = useState<IRadioOption[]>([]);
  const [search, setSearch] = useState('');

  const options: IRadioOption[] = useMemo(() => {
    return SUPPORTED_LANGUAGES.map((langCode: string) => {
      const translatedNames = new Intl.DisplayNames([language], { type: 'language' });
      const translatedName = translatedNames.of(langCode)!;

      const originalNames = new Intl.DisplayNames([langCode], { type: 'language' });
      const originalName = originalNames.of(langCode)!;

      return {
        langCode,
        translatedName,
        originalName,
      };
    }).map(({ langCode, translatedName, originalName }) => ({
      label: translatedName,
      subLabel: originalName,
      value: langCode,
    }));
  }, [language]);

  useEffect(() => {
    if (!isActive) setSearch('');
  }, [isActive]);

  useEffectWithPrevDeps(([prevIsActive]) => {
    if (prevIsActive === isActive) return;
    if (isActive && displayedOptions.length) return;

    const current = options.find((option) => option.value === language);
    const otherLanguages = options.filter((option) => option.value !== language);

    const [selected, unselected] = partition(otherLanguages, (option) => doNotTranslate.includes(option.value));

    setDisplayedOptions([current!, ...selected, ...unselected]);
  }, [isActive, doNotTranslate, displayedOptions.length, language, options]);

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = event.currentTarget;
    let newDoNotTranslate: string[];
    if (checked) {
      newDoNotTranslate = unique([...doNotTranslate, value]);
    } else {
      newDoNotTranslate = doNotTranslate.filter((v) => v !== value);
    }

    setSettingOption({
      doNotTranslate: newDoNotTranslate,
    });
  }, [doNotTranslate, setSettingOption]);

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  }, []);

  const filteredDisplayedOptions = useMemo(() => {
    if (!search.trim()) {
      return displayedOptions;
    }

    return displayedOptions.filter((option) => (
      option.label.toLowerCase().includes(search.toLowerCase())
      || option.subLabel?.toLowerCase().includes(search.toLowerCase())
      || option.value.toLowerCase().includes(search.toLowerCase())
    ));
  }, [displayedOptions, search]);

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  return (
    <div className={buildClassName(styles.root, 'settings-content custom-scroll')}>
      <div className={buildClassName(styles.item, 'settings-item')}>
        <InputText
          key="search"
          value={search}
          onChange={handleSearch}
          placeholder={lang('Search')}
          teactExperimentControlled
        />
        <div className={buildClassName(styles.languages, 'radio-group custom-scroll')}>
          {filteredDisplayedOptions.map((option) => (
            <Checkbox
              className={styles.checkbox}
              label={option.label}
              subLabel={option.subLabel}
              checked={doNotTranslate.includes(option.value)}
              value={option.value}
              key={option.value}
              onChange={handleChange}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const {
      language, doNotTranslate,
    } = global.settings.byKey;

    return {
      language,
      doNotTranslate,
    };
  },
)(SettingsDoNotTranslate));
