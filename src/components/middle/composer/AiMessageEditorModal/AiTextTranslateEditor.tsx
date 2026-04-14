import { memo, useMemo, useRef, useState } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiAiComposeStyle, ApiComposedMessageWithAI, ApiFormattedText } from '../../../../api/types';
import type { IAnchorPosition } from '../../../../types';

import { SUPPORTED_TRANSLATION_LANGUAGES } from '../../../../config';
import buildClassName from '../../../../util/buildClassName';
import { renderTextWithEntities } from '../../../common/helpers/renderTextWithEntities';

import useFlag from '../../../../hooks/useFlag';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useTextLanguage from '../../../../hooks/useTextLanguage';

import CheckboxField from '../../../gili/templates/CheckboxField';
import ExpandableText from '../../../ui/ExpandableText';
import Menu from '../../../ui/Menu';
import MenuItem from '../../../ui/MenuItem';
import TranslationToneSelector from '../../message/TranslationToneSelector';
import { AiEditorCopyButton, AiEditorErrorMessage, AiEditorResultArea } from './AiEditorShared';

import sharedStyles from './AiEditorShared.module.scss';
import modalStyles from './AiMessageEditorModal.module.scss';
import styles from './AiTextTranslateEditor.module.scss';

const EMPTY_AI_COMPOSE_STYLES: ApiAiComposeStyle[] = [];

type OwnProps = {
  text?: ApiFormattedText;
  selectedLanguage?: string;
  selectedTone?: string;
  shouldEmojify?: boolean;
  isLoading?: boolean;
  result?: ApiComposedMessageWithAI;
  error?: 'floodPremium' | 'aiError' | 'generic';
  isPremium?: boolean;
};

type StateProps = {
  aiComposeStyles: ApiAiComposeStyle[];
};

const AiTextTranslateEditor = ({
  text,
  selectedLanguage,
  selectedTone,
  shouldEmojify,
  isLoading,
  result,
  error,
  isPremium,
  aiComposeStyles,
}: OwnProps & StateProps) => {
  const {
    setAiMessageEditorTranslateOptions,
    composeWithAiMessageEditor,
  } = getActions();

  const lang = useLang();

  const [isMenuOpen, openMenu, closeMenu] = useFlag(false);
  const [menuAnchor, setMenuAnchor] = useState<IAnchorPosition | undefined>();

  const triggerRef = useRef<HTMLSpanElement>();

  const detectedLanguage = useTextLanguage(text?.text);
  const hasError = Boolean(error);

  const currentLanguageCode = lang.code;

  const languages = useMemo(() => SUPPORTED_TRANSLATION_LANGUAGES.map((langCode: string) => {
    const displayNames = new Intl.DisplayNames([currentLanguageCode], { type: 'language' });
    const displayName = displayNames.of(langCode) || langCode;

    return {
      langCode,
      displayName,
    };
  }), [currentLanguageCode]);

  const detectedLanguageName = useMemo(() => {
    if (!detectedLanguage) return undefined;
    const displayNames = new Intl.DisplayNames([currentLanguageCode], { type: 'language' });
    return displayNames.of(detectedLanguage);
  }, [detectedLanguage, currentLanguageCode]);

  const selectedLanguageName = useMemo(() => {
    if (!selectedLanguage) return undefined;
    const displayNames = new Intl.DisplayNames([currentLanguageCode], { type: 'language' });
    return displayNames.of(selectedLanguage);
  }, [selectedLanguage, currentLanguageCode]);

  const handleLanguageSelect = useLastCallback((langCode: string) => {
    setAiMessageEditorTranslateOptions({ selectedLanguage: langCode });
    composeWithAiMessageEditor({
      translateToLang: langCode,
      isEmojify: shouldEmojify,
      changeTone: selectedTone,
    });
  });

  const handleEmojifyChange = useLastCallback((newEmojify: boolean) => {
    setAiMessageEditorTranslateOptions({ shouldEmojify: newEmojify });
    if (selectedLanguage) {
      composeWithAiMessageEditor({
        translateToLang: selectedLanguage,
        isEmojify: newEmojify,
        changeTone: selectedTone,
      });
    }
  });

  const handleTriggerClick = useLastCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuAnchor({ x: rect.left, y: rect.bottom });
      openMenu();
    }
  });

  const getTriggerElement = useLastCallback(() => triggerRef.current);
  const getRootElement = useLastCallback(() => document.body);
  const getMenuElement = useLastCallback(() => document.querySelector('.language-menu .bubble'));
  const getLayout = useLastCallback(() => ({ withPortal: true }));

  const handleToneSelect = useLastCallback((tone?: string) => {
    setAiMessageEditorTranslateOptions({ selectedTone: tone });
    if (selectedLanguage) {
      composeWithAiMessageEditor({
        translateToLang: selectedLanguage,
        isEmojify: shouldEmojify,
        changeTone: tone,
      });
    }
  });

  const displayResult = result?.resultText;

  const languageIndex = SUPPORTED_TRANSLATION_LANGUAGES.indexOf(selectedLanguage || '');
  const toneIndex = aiComposeStyles.findIndex(({ tone }) => tone === selectedTone);
  const totalLanguages = SUPPORTED_TRANSLATION_LANGUAGES.length;
  const totalTones = aiComposeStyles.length;
  const transitionKey = languageIndex
    + (toneIndex + 1) * totalLanguages
    + (shouldEmojify ? totalLanguages * (totalTones + 1) : 0);

  function renderResultText() {
    if (hasError) {
      return <AiEditorErrorMessage error={error} isPremium={isPremium} />;
    }

    return displayResult && renderTextWithEntities({
      text: displayResult.text,
      entities: displayResult.entities,
    });
  }

  return (
    <div className={modalStyles.editorBlock}>
      <div className={styles.section}>
        <div className={sharedStyles.labelRow}>
          <span className={sharedStyles.label}>
            {lang('AiMessageEditorFrom')}
          </span>
          <span className={styles.sourceLanguage}>
            {detectedLanguageName}
          </span>
        </div>
        <ExpandableText text={text?.text} />
      </div>

      <div className={sharedStyles.separator} />

      <div className={sharedStyles.optionsRow}>
        <div className={sharedStyles.labelRow}>
          <span className={sharedStyles.label}>
            {lang('AiMessageEditorTo')}
          </span>
          <span
            ref={triggerRef}
            className={styles.languageLink}
            onClick={handleTriggerClick}
          >
            {selectedLanguageName}
            <i className="icon icon-down" />
          </span>
          <Menu
            isOpen={isMenuOpen}
            anchor={menuAnchor}
            getTriggerElement={getTriggerElement}
            getRootElement={getRootElement}
            getMenuElement={getMenuElement}
            getLayout={getLayout}
            className={buildClassName('language-menu', 'with-menu-transitions', styles.languageMenu)}
            autoClose
            onClose={closeMenu}
            withPortal
          >
            <TranslationToneSelector
              selectedTone={selectedTone}
              onSelectTone={handleToneSelect}
            />
            <div className={buildClassName(styles.languageItems, 'custom-scroll')}>
              {languages.map(({ langCode, displayName }) => (
                <MenuItem
                  key={langCode}
                  onClick={() => handleLanguageSelect(langCode)}
                >
                  {displayName}
                </MenuItem>
              ))}
            </div>
          </Menu>
        </div>
        <CheckboxField
          className={sharedStyles.emojifyCheckbox}
          controlClassName={sharedStyles.emojifyCheckboxControl}
          labelClassName={sharedStyles.emojifyCheckboxLabel}
          label={lang('AiMessageEditorEmojify')}
          checked={Boolean(shouldEmojify)}
          isRound
          onChange={handleEmojifyChange}
        />
      </div>

      <AiEditorResultArea isLoading={isLoading} transitionKey={transitionKey}>
        {renderResultText()}
      </AiEditorResultArea>
      <AiEditorCopyButton
        textToCopy={result?.resultText?.text || text?.text}
        isHidden={isLoading || hasError || !displayResult?.text}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    return {
      aiComposeStyles: global.appConfig.aiComposeStyles || EMPTY_AI_COMPOSE_STYLES,
    };
  },
)(AiTextTranslateEditor));
