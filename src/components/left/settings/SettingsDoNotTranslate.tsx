import {
  memo, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { AccountSettings } from '../../../types';

import { SUPPORTED_TRANSLATION_LANGUAGES } from '../../../config';
import buildClassName from '../../../util/buildClassName';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import ItemPicker, { type ItemPickerOption } from '../../common/pickers/ItemPicker';

import styles from './SettingsDoNotTranslate.module.scss';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = Pick<AccountSettings, 'doNotTranslate'>;

const SettingsDoNotTranslate = ({
  isActive,
  doNotTranslate,
  onReset,
}: OwnProps & StateProps) => {
  const { setSettingOption } = getActions();

  const lang = useLang();
  const language = lang.code;
  const [searchQuery, setSearchQuery] = useState<string>('');

  const displayedOptionList: ItemPickerOption[] = useMemo(() => {
    const translatedNames = new Intl.DisplayNames([language], { type: 'language' });
    const options = SUPPORTED_TRANSLATION_LANGUAGES.map((langCode: string) => {
      const translatedName = translatedNames.of(langCode);

      const originalName = new Intl.DisplayNames([langCode], { type: 'language' })
        .of(langCode);

      if (!translatedName || !originalName) {
        return undefined;
      }

      return {
        value: langCode,
        label: translatedName,
        subLabel: originalName,
      };
    }).filter(Boolean);

    if (!searchQuery.trim()) {
      const currentLanguageOption = options.find((option) => option.value === language);
      const otherOptionList = options.filter((option) => option.value !== language);
      return currentLanguageOption ? [currentLanguageOption, ...otherOptionList] : options;
    }

    return options?.filter((option) => (
      option.label.toLowerCase().includes(searchQuery.toLowerCase())
      || option.subLabel?.toLowerCase().includes(searchQuery.toLowerCase())
      || option.value.toLowerCase().includes(searchQuery.toLowerCase())
    ));
  }, [language, searchQuery]);

  const handleChange = useLastCallback((newSelectedIds: string[]) => {
    setSettingOption({
      doNotTranslate: newSelectedIds,
    });
  });

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  return (
    <div className={buildClassName(styles.root, 'settings-content infinite-scroll')}>
      <div className={buildClassName(styles.item)}>
        <ItemPicker
          className={styles.picker}
          items={displayedOptionList}
          selectedValues={doNotTranslate}
          onSelectedValuesChange={handleChange}
          filterValue={searchQuery}
          onFilterChange={setSearchQuery}
          isSearchable
          allowMultiple
          withDefaultPadding
          itemInputType="checkbox"
          searchInputId="lang-picker-search"
        />
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const {
      doNotTranslate,
    } = global.settings.byKey;

    return {
      doNotTranslate,
    };
  },
)(SettingsDoNotTranslate));
