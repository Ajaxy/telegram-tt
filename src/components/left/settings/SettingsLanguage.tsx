import {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, getPromiseActions, withGlobal } from '../../../global';

import type { SharedSettings } from '../../../global/types';
import type { AccountSettings } from '../../../types';
import { SettingsScreens } from '../../../types';

import { selectIsCurrentUserPremium } from '../../../global/selectors';
import { selectSharedSettings } from '../../../global/selectors/sharedState';
import { IS_TRANSLATION_SUPPORTED } from '../../../util/browser/windowEnvironment';
import { copyTextToClipboard } from '../../../util/clipboard';
import { getTranslationFn } from '../../../util/localization';

import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import ItemPicker, { type ItemPickerOption } from '../../common/pickers/ItemPicker';
import PickerItem from '../../common/pickers/PickerItem';
import Island, { IslandDescription, IslandTitle } from '../../gili/layout/Island';
import Checkbox from '../../ui/Checkbox';
import DropdownMenu from '../../ui/DropdownMenu';
import ListItem from '../../ui/ListItem';
import Loading from '../../ui/Loading';
import MenuItem from '../../ui/MenuItem';
import Radio from '../../ui/Radio';
import Transition from '../../ui/Transition';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = {
  isCurrentUserPremium: boolean;
} & Pick<AccountSettings, 'canTranslate' | 'canTranslateChats' | 'doNotTranslate'>
& Pick<SharedSettings, 'language' | 'languages' | 'customLanguages'>;

const SettingsLanguage = ({
  isActive,
  isCurrentUserPremium,
  languages,
  language,
  customLanguages,
  canTranslate,
  canTranslateChats,
  doNotTranslate,
  onReset,
}: OwnProps & StateProps) => {
  const {
    loadLanguages,
    setSettingOption,
    removeCustomLanguage,
    showNotification,
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
    const newLanguage = languages?.find((item) => item.langCode === langCode)
      || customLanguages?.find((item) => item.langCode === langCode);
    if (!newLanguage) return;

    const requestId = ++languageRequestRef.current;
    setSelectedLanguage(langCode);
    markIsLoading();

    try {
      await getPromiseActions().applyLanguage({ language: newLanguage });
    } finally {
      if (requestId === languageRequestRef.current) {
        setSelectedLanguage(getTranslationFn().rawCode);
        unmarkIsLoading();
      }
    }
  });

  const savedLanguages = useMemo(() => customLanguages?.filter(({ langCode }) => (
    !languages?.some((item) => item.langCode === langCode)
  )), [customLanguages, languages]);

  const handleCopyLink = useLastCallback((langCode: string) => {
    if (copyTextToClipboard(`https://t.me/setlanguage/${encodeURIComponent(langCode)}`)) {
      showNotification({ message: { key: 'LinkCopied' } });
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
      const originalNames = new Intl.DisplayNames([lang.code], { type: 'language' });
      return originalNames.of(doNotTranslate[0])!;
    }

    return lang('Languages', { count: doNotTranslate.length }, { pluralValue: doNotTranslate.length });
  }, [doNotTranslate, lang]);

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

      <IslandTitle>{lang('LocalizationInterfaceLanguage')}</IslandTitle>
      {Boolean(savedLanguages?.length) && (
        <Island>
          {savedLanguages.map((savedLanguage) => (
            <div className="settings-custom-language" key={savedLanguage.langCode}>
              <PickerItem
                title={savedLanguage.nativeName}
                subtitle={savedLanguage.name}
                inputElement={(
                  <Radio
                    checked={language === savedLanguage.langCode}
                    isLoading={isLoading && selectedLanguage === savedLanguage.langCode}
                    onlyInput
                  />
                )}
                ripple
                onClick={() => handleChange(savedLanguage.langCode)}
              />
              <DropdownMenu positionX="right" withPortal>
                <MenuItem icon="link" onClick={() => handleCopyLink(savedLanguage.langCode)}>
                  {lang('CopyLink')}
                </MenuItem>
                <MenuItem
                  icon="delete"
                  destructive
                  disabled={language === savedLanguage.langCode}
                  onClick={() => removeCustomLanguage({ langCode: savedLanguage.langCode })}
                >
                  {lang('BoxRemove')}
                </MenuItem>
              </DropdownMenu>
            </div>
          ))}
        </Island>
      )}
      <Transition activeKey={options ? 1 : 0} name="fade" className="settings-language-transition">
        {options ? (
          <Island>
            <ItemPicker
              items={options}
              selectedValue={isLoading ? selectedLanguage : language}
              forceRenderAllItems
              onSelectedValueChange={handleChange}
              itemInputType="radio"
              className="settings-picker"
            />
          </Island>
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
    const { language, languages, customLanguages } = selectSharedSettings(global);

    const isCurrentUserPremium = selectIsCurrentUserPremium(global);

    return {
      isCurrentUserPremium,
      languages,
      language,
      customLanguages,
      canTranslate,
      canTranslateChats,
      doNotTranslate,
    };
  },
)(SettingsLanguage));
