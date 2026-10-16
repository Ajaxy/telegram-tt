import {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { SharedSettings } from '../../../global/types';
import type { AccountSettings } from '../../../types';
import { SettingsScreens } from '../../../types';

import { selectIsCurrentUserPremium } from '../../../global/selectors';
import { selectSharedSettings } from '../../../global/selectors/sharedState';
import { IS_TRANSLATION_SUPPORTED } from '../../../util/browser/windowEnvironment';
import { getTranslationFn, loadAndChangeLanguage } from '../../../util/localization';

import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import ItemPicker, { type ItemPickerOption } from '../../common/pickers/ItemPicker';
import Island, { IslandDescription, IslandTitle } from '../../gili/layout/Island';
import Checkbox from '../../ui/Checkbox';
import ListItem from '../../ui/ListItem';
import Loading from '../../ui/Loading';
import Transition from '../../ui/Transition';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = {
  isCurrentUserPremium: boolean;
} & Pick<AccountSettings, 'canTranslate' | 'canTranslateChats' | 'doNotTranslate'>
& Pick<SharedSettings, 'language' | 'languages'>;

const SettingsLanguage = ({
  isActive,
  isCurrentUserPremium,
  languages,
  language,
  canTranslate,
  canTranslateChats,
  doNotTranslate,
  onReset,
}: OwnProps & StateProps) => {
  const {
    loadLanguages,
    setSettingOption,
    setSharedSettingOption,
    openPremiumModal,
    openSettingsScreen,
  } = getActions();

  const lang = useLang();

  const [selectedLanguage, setSelectedLanguage] = useState<string>(language);
  const [isLoading, markIsLoading, unmarkIsLoading] = useFlag();
  const languageRequestRef = useRef(0);

  const canTranslateChatsEnabled = isCurrentUserPremium && canTranslateChats;

  useEffect(() => {
    if (!languages?.length) {
      loadLanguages();
    }
  }, [languages]);

  const handleChange = useLastCallback(async (langCode: string) => {
    const requestId = ++languageRequestRef.current;
    setSelectedLanguage(langCode);
    markIsLoading();

    try {
      if (await loadAndChangeLanguage(langCode) && requestId === languageRequestRef.current) {
        setSharedSettingOption({ language: langCode });
      }
    } finally {
      if (requestId === languageRequestRef.current) {
        setSelectedLanguage(getTranslationFn().rawCode);
        unmarkIsLoading();
      }
    }
  });

  const options = useMemo(() => {
    if (!languages) return undefined;
    const currentLangCode = (window.navigator.language || 'en').toLowerCase();
    const shortLangCode = currentLangCode.substr(0, 2);

    return languages.map(({ langCode, nativeName, name }) => ({
      value: langCode,
      label: nativeName,
      subLabel: name,
      isLoading: langCode === selectedLanguage && isLoading,
    } satisfies ItemPickerOption)).sort((a) => {
      return currentLangCode && (a.value === currentLangCode || a.value === shortLangCode) ? -1 : 0;
    });
  }, [isLoading, languages, selectedLanguage]);

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

    return lang('Languages', { count: doNotTranslate.length }, { pluralValue: doNotTranslate.length });
  }, [doNotTranslate, lang, language]);

  const handleDoNotSelectOpen = useLastCallback(() => {
    openSettingsScreen({ screen: SettingsScreens.DoNotTranslate });
  });

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  return (
    <div className="settings-content settings-language custom-scroll">
      {IS_TRANSLATION_SUPPORTED && (
        <>
          <Island>
            <Checkbox
              label={lang('ShowTranslateButton')}
              checked={canTranslate}
              onCheck={handleShouldTranslateChange}
            />
            <Checkbox
              label={lang('ShowTranslateChatButton')}
              checked={canTranslateChatsEnabled}
              disabled={!isCurrentUserPremium}
              rightIcon={!isCurrentUserPremium ? 'lock' : undefined}
              onClickLabel={handleShouldTranslateChatsClick}
              onCheck={handleShouldTranslateChatsChange}
            />
            {(canTranslate || canTranslateChatsEnabled) && (
              <ListItem
                narrow
                onClick={handleDoNotSelectOpen}
              >
                {lang('DoNotTranslate')}
                <span className="settings-item__current-value">{doNotTranslateText}</span>
              </ListItem>
            )}
          </Island>
          <IslandDescription>
            {lang('TranslateSettingsAbout')}
          </IslandDescription>
        </>
      )}

      <Transition activeKey={options ? 1 : 0} name="fade" className="settings-language-transition">
        {options ? (
          <>
            <IslandTitle>{lang('LocalizationInterfaceLanguage')}</IslandTitle>
            <Island>
              <ItemPicker
                items={options}
                selectedValue={selectedLanguage}
                forceRenderAllItems
                onSelectedValueChange={handleChange}
                itemInputType="radio"
                className="settings-picker"
              />
            </Island>
          </>
        ) : (
          <Loading />
        )}
      </Transition>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const {
      canTranslate, canTranslateChats, doNotTranslate,
    } = global.settings.byKey;
    const { language, languages } = selectSharedSettings(global);

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
