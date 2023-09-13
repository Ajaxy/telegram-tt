import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiLanguage } from '../../../api/types';
import type { ISettings, LangCode } from '../../../types';
import { SettingsScreens } from '../../../types';

import { selectIsCurrentUserPremium } from '../../../global/selectors';
import { setLanguage } from '../../../util/langProvider';
import { IS_TRANSLATION_SUPPORTED } from '../../../util/windowEnvironment';

import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Checkbox from '../../ui/Checkbox';
import ListItem from '../../ui/ListItem';
import Loading from '../../ui/Loading';
import RadioGroup from '../../ui/RadioGroup';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
  onScreenSelect: (screen: SettingsScreens) => void;
};

type StateProps = {
  isCurrentUserPremium: boolean;
} & Pick<ISettings, 'languages' | 'language' | 'canTranslate' | 'canTranslateChats' | 'doNotTranslate'>;

const SettingsLanguage: FC<OwnProps & StateProps> = ({
  isActive,
  isCurrentUserPremium,
  languages,
  language,
  canTranslate,
  canTranslateChats,
  doNotTranslate,
  onScreenSelect,
  onReset,
}) => {
  const {
    loadLanguages,
    loadAttachBots,
    setSettingOption,
    openPremiumModal,
  } = getActions();

  const [selectedLanguage, setSelectedLanguage] = useState<string>(language);
  const [isLoading, markIsLoading, unmarkIsLoading] = useFlag();

  const canTranslateChatsEnabled = isCurrentUserPremium && canTranslateChats;

  const lang = useLang();

  useEffect(() => {
    if (!languages?.length) {
      loadLanguages();
    }
  }, [languages]);

  const handleChange = useLastCallback((langCode: string) => {
    setSelectedLanguage(langCode);
    markIsLoading();

    void setLanguage(langCode as LangCode, () => {
      unmarkIsLoading();

      setSettingOption({ language: langCode as LangCode });

      loadAttachBots(); // Should be refetched every language change
    });
  });

  const options = useMemo(() => {
    return languages ? buildOptions(languages) : undefined;
  }, [languages]);

  const handleShouldTranslateChange = useLastCallback((newValue: boolean) => {
    setSettingOption({ canTranslate: newValue });
  });

  const handleShouldTranslateChatsChange = useLastCallback((newValue: boolean) => {
    setSettingOption({ canTranslateChats: newValue });
  });

  const handleShouldTranslateChatsClick = useLastCallback(() => {
    if (!isCurrentUserPremium) {
      openPremiumModal({
        initialSection: 'translations',
      });
    }
  });

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

  const handleDoNotSelectOpen = useLastCallback(() => {
    onScreenSelect(SettingsScreens.DoNotTranslate);
  });

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
          <Checkbox
            className="pb-2"
            label={lang('ShowTranslateChatButton')}
            checked={canTranslateChatsEnabled}
            disabled={!isCurrentUserPremium}
            rightIcon={!isCurrentUserPremium ? 'lock' : undefined}
            onClickLabel={handleShouldTranslateChatsClick}
            onCheck={handleShouldTranslateChatsChange}
          />
          {(canTranslate || canTranslateChatsEnabled) && (
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
        <h4 className="settings-item-header mb-4">{lang('Localization.InterfaceLanguage')}</h4>
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
      language, languages, canTranslate, canTranslateChats, doNotTranslate,
    } = global.settings.byKey;

    const isCurrentUserPremium = selectIsCurrentUserPremium(global);

    return {
      isCurrentUserPremium,
      languages,
      language,
      canTranslate,
      canTranslateChats,
      doNotTranslate,
    };
  },
)(SettingsLanguage));
