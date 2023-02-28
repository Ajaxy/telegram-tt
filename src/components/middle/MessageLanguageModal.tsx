import React, {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { FC } from '../../lib/teact/teact';

import { selectLanguageCode, selectRequestedTranslationLanguage, selectTabState } from '../../global/selectors';
import { SUPPORTED_TRANSLATION_LANGUAGES } from '../../config';
import buildClassName from '../../util/buildClassName';
import renderText from '../common/helpers/renderText';

import useLang from '../../hooks/useLang';

import Modal from '../ui/Modal';
import ListItem from '../ui/ListItem';
import InputText from '../ui/InputText';

import styles from './MessageLanguageModal.module.scss';

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

const MessageLanguageModal: FC<OwnProps & StateProps> = ({
  isOpen,
  chatId,
  messageId,
  activeTranslationLanguage,
  currentLanguageCode,
}) => {
  const { requestMessageTranslation, closeMessageLanguageModal } = getActions();

  const [search, setSearch] = useState('');
  const lang = useLang();

  const handleSelect = useCallback((toLanguageCode: string) => {
    if (!chatId || !messageId) return;

    requestMessageTranslation({ chatId, id: messageId, toLanguageCode });
    closeMessageLanguageModal();
  }, [chatId, closeMessageLanguageModal, messageId, requestMessageTranslation]);

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  }, []);

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
      onClose={closeMessageLanguageModal}
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
            className={styles.listItem}
            secondaryIcon={activeTranslationLanguage === langCode ? 'check' : undefined}
            disabled={activeTranslationLanguage === langCode}
            multiline
            narrow
            // eslint-disable-next-line react/jsx-no-bind
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
  (global): StateProps => {
    const { chatId, messageId } = selectTabState(global).messageLanguageModal || {};

    const currentLanguageCode = selectLanguageCode(global);
    const activeTranslationLanguage = chatId && messageId
      ? selectRequestedTranslationLanguage(global, chatId, messageId) : undefined;

    return {
      chatId,
      messageId,
      activeTranslationLanguage,
      currentLanguageCode,
    };
  },
)(MessageLanguageModal));
