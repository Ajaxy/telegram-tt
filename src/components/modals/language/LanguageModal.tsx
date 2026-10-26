import { memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { TabState } from '../../../global/types';

import { selectSharedSettings } from '../../../global/selectors/sharedState';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Button from '../../ui/Button';
import Link from '../../ui/Link';
import Loading from '../../ui/Loading';
import Island, { IslandText } from '@gili/layout/Island';
import Modal, {
  ModalCloseButton, ModalFooterActions, ModalHeader, ModalTitle,
} from '@gili/modal/Modal';

import styles from './LanguageModal.module.scss';

export type OwnProps = {
  modal: TabState['languageModal'];
};

type StateProps = {
  currentLanguage: string;
};

const PERCENTAGE_SCALE = 100;

const LanguageModal = ({ modal, currentLanguage }: OwnProps & StateProps) => {
  const { closeLanguageModal, openLanguageModal, applyLanguage } = getActions();
  const lang = useLang();

  const language = modal?.language;
  const isActive = language?.langCode === currentLanguage;
  const isEmpty = language?.stringsCount === 0;
  const canApply = Boolean(language && !isActive && !isEmpty);

  const handleApply = useLastCallback(() => {
    if (language) applyLanguage({ language });
  });
  const handleRetry = useLastCallback(() => {
    if (modal) openLanguageModal({ langCode: modal.langCode });
  });
  const handleClose = useLastCallback(() => closeLanguageModal());

  function renderDescription() {
    if (!language) {
      if (modal?.isLoading) return <Loading />;
      return lang(modal?.error === 'unsupported' ? 'LanguageNotFound' : 'LanguageLoadFailed');
    }
    const settings = (
      <Link isPrimary href="tg://settings/language" onClick={handleClose}>
        {lang('Settings')}
      </Link>
    );
    if (isActive) return lang('LanguageAlready', { settings }, { withNodes: true });

    const percentage = language.stringsCount
      ? Math.max(0, Math.min(PERCENTAGE_SCALE,
        Math.floor(language.translatedCount / language.stringsCount * PERCENTAGE_SCALE))) : 0;
    const key = isEmpty ? 'LanguageUnknownCustomAlert'
      : language.isOfficial ? 'LanguageAlert' : 'LanguageCustomAlert';
    const link = (
      <a className={styles.link} href={language.translationsUrl} target="_blank" rel="noopener noreferrer">
        {lang('LanguageTranslateLink')}
      </a>
    );
    return lang(key, { language: language.nativeName, percent: percentage, link, settings }, { withNodes: true });
  }

  return (
    <Modal
      isOpen={Boolean(modal)}
      onClose={handleClose}
      width="slim"
      height="auto"
      header={(
        <ModalHeader>
          <ModalTitle>{lang('LanguageTitle')}</ModalTitle>
          <ModalCloseButton />
        </ModalHeader>
      )}
      stickyFooter={(
        <ModalFooterActions isVertical className={styles.footer}>
          {canApply && (
            <Button isLoading={modal?.isApplying} disabled={modal?.isApplying} onClick={handleApply}>
              {lang('LanguageApply')}
            </Button>
          )}
          {modal?.error === 'failed' && !language && (
            <Button onClick={handleRetry}>{lang('Retry')}</Button>
          )}
          <Button isText onClick={handleClose}>{lang('Cancel')}</Button>
        </ModalFooterActions>
      )}
    >
      {language && (
        <Island>
          <IslandText>
            <div className={styles.name} dir="auto">{language.nativeName}</div>
            <div className={styles.englishName} dir="auto">{language.name}</div>
          </IslandText>
        </Island>
      )}
      <Island>
        <IslandText className={styles.description}>{renderDescription()}</IslandText>
      </Island>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>((global): Complete<StateProps> => ({
  currentLanguage: selectSharedSettings(global).language,
}))(LanguageModal));
