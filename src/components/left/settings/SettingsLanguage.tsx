import React, {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
import { SettingsScreens } from '../../../types';
import type { ISettings, LangCode } from '../../../types';
import type { ApiLanguage } from '../../../api/types';

import { setLanguage } from '../../../util/langProvider';
import { IS_TRANSLATION_SUPPORTED } from '../../../util/windowEnvironment';

import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';

import RadioGroup from '../../ui/RadioGroup';
import Loading from '../../ui/Loading';
import Checkbox from '../../ui/Checkbox';
import ListItem from '../../ui/ListItem';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
  onScreenSelect: (screen: SettingsScreens) => void;
};

type StateProps = {
  lastSyncTime?: number;
} & Pick<ISettings, 'languages' | 'language' | 'canTranslate' | 'doNotTranslate'>;

const SettingsLanguage: FC<OwnProps & StateProps> = ({
  isActive,
  languages,
  language,
  canTranslate,
  doNotTranslate,
  lastSyncTime,
  onScreenSelect,
  onReset,
}) => {
  const {
    loadLanguages,
    loadAttachBots,
    setSettingOption,
  } = getActions();

  const [selectedLanguage, setSelectedLanguage] = useState<string>(language);
  const [isLoading, markIsLoading, unmarkIsLoading] = useFlag();

  const lang = useLang();

  useEffect(() => {
    if (lastSyncTime && !languages?.length) {
      loadLanguages();
    }
  }, [languages, lastSyncTime, loadLanguages]);

  const handleChange = useCallback((langCode: string) => {
    setSelectedLanguage(langCode);
    markIsLoading();

    void setLanguage(langCode as LangCode, () => {
      unmarkIsLoading();

      setSettingOption({ language: langCode as LangCode });

      loadAttachBots(); // Should be refetched every language change
    });
  }, [markIsLoading, unmarkIsLoading, setSettingOption, loadAttachBots]);

  const options = useMemo(() => {
    return languages ? buildOptions(languages) : undefined;
  }, [languages]);

  const handleShouldTranslateChange = useCallback((newValue: boolean) => {
    setSettingOption({ canTranslate: newValue });
  }, [setSettingOption]);

  const doNotTranslateText = useMemo(() => {
    if (!IS_TRANSLATION_SUPPORTED || !doNotTranslate.length) {
      return undefined;
    }

    if (doNotTranslate.length === 1) {
      const originalNames = new Intl.DisplayNames([language], { type: 'language' });
      return originalNames.of(doNotTranslate[0])!;
    }

    return lang('Languages', doNotTranslate.length);
  }, [doNotTranslate, lang, language]);

  const handleDoNotSelectOpen = useCallback(() => {
    onScreenSelect(SettingsScreens.DoNotTranslate);
  }, [onScreenSelect]);

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  return (
    <div className="settings-content settings-language custom-scroll">
      {IS_TRANSLATION_SUPPORTED && (
        <div className="settings-item">
          <Checkbox
            label={lang('ShowTranslateButton')}
            checked={canTranslate}
            onCheck={handleShouldTranslateChange}
          />
          {canTranslate && (
            <ListItem
              onClick={handleDoNotSelectOpen}
            >
              {lang('DoNotTranslate')}
              <span className="settings-item__current-value">{doNotTranslateText}</span>
            </ListItem>
          )}
          <p className="settings-item-description mb-0 mt-1">
            {lang('lng_translate_settings_about')}
          </p>
        </div>
      )}
      <div className="settings-item">
        {options ? (
          <RadioGroup
            name="language-settings"
            options={options}
            selected={selectedLanguage}
            loadingOption={isLoading ? selectedLanguage : undefined}
            onChange={handleChange}
          />
        ) : (
          <Loading />
        )}
      </div>
    </div>
  );
};

function buildOptions(languages: ApiLanguage[]) {
  const currentLangCode = (window.navigator.language || 'en').toLowerCase();
  const shortLangCode = currentLangCode.substr(0, 2);

  return languages.map(({ langCode, nativeName, name }) => ({
    value: langCode,
    label: nativeName,
    subLabel: name,
  })).sort((a) => {
    return currentLangCode && (a.value === currentLangCode || a.value === shortLangCode) ? -1 : 0;
  });
}

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const {
      language, languages, canTranslate, doNotTranslate,
    } = global.settings.byKey;

    return {
      lastSyncTime: global.lastSyncTime,
      languages,
      language,
      canTranslate,
      doNotTranslate,
    };
  },
)(SettingsLanguage));
