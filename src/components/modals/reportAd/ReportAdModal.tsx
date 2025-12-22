import {
  memo, useEffect, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { TabState } from '../../../global/types';

import { requestMeasure, requestMutation } from '../../../lib/fasterdom/fasterdom';
import buildClassName from '../../../util/buildClassName';

import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import SafeLink from '../../common/SafeLink';
import Button from '../../ui/Button';
import ListItem from '../../ui/ListItem';
import Modal from '../../ui/Modal';
import Transition, { ACTIVE_SLIDE_CLASS_NAME, TO_SLIDE_CLASS_NAME } from '../../ui/Transition';

import styles from './ReportAdModal.module.scss';

const ADDED_PADDING = 56;

export type OwnProps = {
  modal: TabState['reportAdModal'];
};

const ReportAdModal = ({
  modal,
}: OwnProps) => {
  const {
    reportSponsored, closeReportAdModal, openPreviousReportAdModal,
  } = getActions();
  const lang = useOldLang();
  const isOpen = Boolean(modal);

  const transitionRef = useRef<HTMLDivElement>();

  const handleOptionClick = useLastCallback((e, option: string) => {
    const { chatId, randomId } = modal!;
    reportSponsored({ peerId: chatId, randomId, option });
  });

  const [renderingSection, renderingDepth] = useMemo(() => {
    if (!modal) return [undefined, 0];
    const sectionDepth = modal.sections.length - 1;
    return [modal.sections[sectionDepth], sectionDepth];
  }, [modal]);

  const handleBackClick = useLastCallback(() => {
    if (!renderingDepth) {
      closeReportAdModal();
      return;
    }

    openPreviousReportAdModal();
  });

  const bottomText = useMemo(() => {
    if (!modal) return undefined;
    const template = lang('lng_report_sponsored_reported_learn');
    const parts = template.split('{link}');
    return [
      parts[0],
      <SafeLink
        text={lang('lng_report_sponsored_reported_link')}
        url={lang('ReportAd.Help_URL')}
      />,
      parts[1],
    ];
  }, [lang, modal]);

  const header = useMemo(() => {
    if (!modal) {
      return undefined;
    }

    const hasSubtitle = Boolean(renderingSection?.subtitle);

    return (
      <div className="modal-header-condensed">
        <Button
          round
          color="translucent"
          size="tiny"
          ariaLabel={lang(renderingDepth ? 'Back' : 'Close')}
          onClick={handleBackClick}
          iconName={renderingDepth ? 'arrow-left' : 'close'}
        />
        <div className={buildClassName('modal-title', styles.modalTitle, hasSubtitle && styles.titleMultiline)}>
          <h3 className={styles.title}>{lang('ReportAd')}</h3>
          {hasSubtitle && (
            <span className={styles.subtitle}>{renderingSection.subtitle}</span>
          )}
        </div>
      </div>
    );
  }, [lang, modal, renderingDepth, renderingSection?.subtitle]);

  useEffect(() => {
    if (!modal) return;
    const slide = document.querySelector<HTMLElement>(`.${ACTIVE_SLIDE_CLASS_NAME} > .${styles.slide}`);
    if (!slide) return;

    const height = slide.scrollHeight;
    requestMutation(() => {
      transitionRef.current!.style.height = `${height + ADDED_PADDING}px`;
    });
  }, [modal]);

  const handleAnimationStart = useLastCallback(() => {
    const slide = document.querySelector<HTMLElement>(`.${TO_SLIDE_CLASS_NAME} > .${styles.slide}`)!;

    requestMeasure(() => {
      const height = slide.scrollHeight;
      requestMutation(() => {
        transitionRef.current!.style.height = `${height + ADDED_PADDING}px`;
      });
    });
  });

  return (
    <Modal
      isOpen={isOpen}
      hasCloseButton
      className={styles.root}
      header={header}
      onClose={closeReportAdModal}
    >
      <Transition
        name="slide"
        className={styles.transition}
        ref={transitionRef}
        activeKey={renderingDepth}
        onStart={handleAnimationStart}
      >
        <div className={styles.slide}>
          <h3 className={styles.sectionTitle}>{renderingSection?.title}</h3>
          {renderingSection?.options.map((option) => (
            <ListItem
              narrow
              secondaryIcon="next"
              className={styles.option}
              buttonClassName={styles.optionButton}
              clickArg={option.option}
              onClick={handleOptionClick}
            >
              <div className={styles.optionText}>{option.text}</div>
            </ListItem>
          ))}
        </div>
        <p className={styles.description}>{bottomText}</p>
      </Transition>
    </Modal>
  );
};

export default memo(ReportAdModal);
