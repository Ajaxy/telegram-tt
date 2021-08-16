import React, {
  FC, memo, useCallback, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import { ISettings, LangCode, SettingsScreens } from '../../../types';
import { ApiLanguage } from '../../../api/types';

import { setLanguage } from '../../../util/langProvider';
import { pick } from '../../../util/iteratees';

import RadioGroup from '../../ui/RadioGroup';
import Loading from '../../ui/Loading';
import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';

type OwnProps = {
  isActive?: boolean;
  onScreenSelect: (screen: SettingsScreens) => void;
  onReset: () => void;
};

type StateProps = Pick<ISettings, 'languages' | 'language'>;

type DispatchProps = Pick<GlobalActions, 'loadLanguages' | 'setSettingOption'>;

const SettingsLanguage: FC<OwnProps & StateProps & DispatchProps> = ({
  isActive,
  onScreenSelect,
  onReset,
  languages,
  language,
  loadLanguages,
  setSettingOption,
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<string>(language);
  const [isLoading, markIsLoading, unmarkIsLoading] = useFlag();

  // TODO Throttle
  useEffect(() => {
    loadLanguages();
  }, [loadLanguages]);

  const handleChange = useCallback((langCode: string) => {
    setSelectedLanguage(langCode);
    markIsLoading();

    void setLanguage(langCode as LangCode, () => {
      unmarkIsLoading();

      setSettingOption({ language: langCode });
    });
  }, [markIsLoading, unmarkIsLoading, setSettingOption]);

  const options = useMemo(() => {
    return languages ? buildOptions(languages) : undefined;
  }, [languages]);

  useHistoryBack(isActive, onReset, onScreenSelect, SettingsScreens.Language);

  return (
    <div className="settings-content settings-item settings-language custom-scroll">
      {options ? (
        <RadioGroup
          name="keyboard-send-settings"
          options={options}
          selected={selectedLanguage}
          loadingOption={isLoading ? selectedLanguage : undefined}
          onChange={handleChange}
        />
      ) : (
        <Loading />
      )}
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
    return {
      languages: global.settings.byKey.languages,
      language: global.settings.byKey.language,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'loadLanguages', 'setSettingOption',
  ]),
)(SettingsLanguage));
