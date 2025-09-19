import type { FC } from '../../lib/teact/teact';
import type React from '../../lib/teact/teact';
import {
  memo, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { SUPPORTED_TRANSLATION_LANGUAGES } from '../../config';
import {
  selectLanguageCode,
  selectRequestedChatTranslationLanguage,
  selectRequestedMessageTranslationLanguage,
  selectTabState,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import renderText from '../common/helpers/renderText';

import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import InputText from '../ui/InputText';
import ListItem from '../ui/ListItem';
import Modal from '../ui/Modal';

import styles from './ChatLanguageModal.module.scss';

type LanguageItem = {
  langCode: string;
  translatedName: string;
  originalName: string;
};

export type OwnProps = {
  isOpen?: boolean;
};

type StateProps = {
  chatId?: string;
  messageId?: number;
  activeTranslationLanguage?: string;
  currentLanguageCode: string;
};

const ChatLanguageModal: FC<OwnProps & StateProps> = ({
  isOpen,
  chatId,
  messageId,
  activeTranslationLanguage,
  currentLanguageCode,
}) => {
  const {
    requestMessageTranslation,
    closeChatLanguageModal,
    setSettingOption,
    requestChatTranslation,
  } = getActions();

  const [search, setSearch] = useState('');
  const lang = useOldLang();

  const handleSelect = useLastCallback((langCode: string) => {
    if (!chatId) return;

    if (messageId) {
      requestMessageTranslation({ chatId, id: messageId, toLanguageCode: langCode });
    } else {
      setSettingOption({ translationLanguage: langCode });
      requestChatTranslation({ chatId, toLanguageCode: langCode });
    }

    closeChatLanguageModal();
  });

  const handleSearch = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  });

  const translateLanguages = useMemo(() => SUPPORTED_TRANSLATION_LANGUAGES.map((langCode: string) => {
    const translatedNames = new Intl.DisplayNames([currentLanguageCode], { type: 'language' });
    const translatedName = translatedNames.of(langCode)!;

    const originalNames = new Intl.DisplayNames([langCode], { type: 'language' });
    const originalName = originalNames.of(langCode)!;

    return {
      langCode,
      translatedName,
      originalName,
    } satisfies LanguageItem;
  }), [currentLanguageCode]);

  useEffect(() => {
    if (!isOpen) setSearch('');
  }, [isOpen]);

  const filteredDisplayedLanguages = useMemo(() => {
    if (!search.trim()) {
      return translateLanguages;
    }

    return translateLanguages.filter(({ langCode, translatedName, originalName }) => (
      translatedName.toLowerCase().includes(search.toLowerCase())
      || originalName.toLowerCase().includes(search.toLowerCase())
      || langCode.toLowerCase().includes(search.toLowerCase())
    ));
  }, [translateLanguages, search]);

  return (
    <Modal
      className={styles.root}
      isSlim
      isOpen={isOpen}
      hasCloseButton
      title={lang('Language')}
      onClose={closeChatLanguageModal}
    >
      <InputText
        key="search"
        value={search}
        onChange={handleSearch}
        placeholder={lang('Search')}
        teactExperimentControlled
      />
      <div className={buildClassName(styles.languages, 'custom-scroll')}>
        {filteredDisplayedLanguages.map(({ langCode, originalName, translatedName }) => (
          <ListItem
            key={langCode}
            className={buildClassName(styles.listItem, 'no-icon')}
            secondaryIcon={activeTranslationLanguage === langCode ? 'check' : undefined}
            disabled={activeTranslationLanguage === langCode}
            multiline
            narrow

            onClick={() => handleSelect(langCode)}
          >
            <span className={buildClassName('title', styles.title)}>
              {renderText(originalName, ['highlight'], { highlight: search })}
            </span>
            <span className={buildClassName('subtitle', styles.subtitle)}>
              {renderText(translatedName, ['highlight'], { highlight: search })}
            </span>
          </ListItem>
        ))}
      </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const { chatId, messageId } = selectTabState(global).chatLanguageModal || {};

    const currentLanguageCode = selectLanguageCode(global);
    const activeTranslationLanguage = chatId
      ? messageId
        ? selectRequestedMessageTranslationLanguage(global, chatId, messageId)
        : selectRequestedChatTranslationLanguage(global, chatId)
      : undefined;

    return {
      chatId,
      messageId,
      activeTranslationLanguage,
      currentLanguageCode,
    };
  },
)(ChatLanguageModal));
