import type { ChangeEvent } from 'react';
import {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { TabState } from '../../../global/types';

import { requestMeasure, requestMutation } from '../../../lib/fasterdom/fasterdom';
import buildClassName from '../../../util/buildClassName';
import { LOCAL_TGS_URLS } from '../../common/helpers/animatedAssets';

import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import AnimatedIconWithPreview from '../../common/AnimatedIconWithPreview';
import Button from '../../ui/Button';
import ListItem from '../../ui/ListItem';
import Modal from '../../ui/Modal';
import TextArea from '../../ui/TextArea';
import Transition, { ACTIVE_SLIDE_CLASS_NAME, TO_SLIDE_CLASS_NAME } from '../../ui/Transition';

import styles from './ReportModal.module.scss';

const MAX_DESCRIPTION = 512;
const ADDED_PADDING = 20;

export type OwnProps = {
  modal: TabState['reportModal'];
};

const ReportModal = ({
  modal,
}: OwnProps) => {
  const {
    reportMessages, reportStory, closeReportModal, openPreviousReportModal,
  } = getActions();
  const lang = useOldLang();
  const isOpen = Boolean(modal);

  const transitionRef = useRef<HTMLDivElement>();

  const [text, setText] = useState('');

  const handleOptionClick = useLastCallback((e, option: string) => {
    const {
      messageIds, subject, peerId, chatId,
    } = modal!;
    if (!messageIds) return;
    switch (subject) {
      case 'message':
        reportMessages({ chatId: chatId!, messageIds, option });
        break;
      case 'story':
        reportStory({
          storyId: messageIds[0], peerId: peerId!, option,
        });
        break;
    }
  });

  const [renderingSection, renderingDepth] = useMemo(() => {
    if (!modal) return [undefined, 0];
    const sectionDepth = modal.sections.length - 1;
    return [modal?.sections[sectionDepth], sectionDepth];
  }, [modal]);

  const handleBackClick = useLastCallback(() => {
    openPreviousReportModal();
  });

  const handleCloseClick = useLastCallback(() => {
    closeReportModal();
  });

  const header = useMemo(() => {
    if (!modal) {
      return undefined;
    }

    const hasSubtitle = Boolean(renderingSection?.subtitle);

    return (
      <div className="modal-header-condensed">
        {renderingDepth ? (
          <Button
            round
            color="translucent"
            size="tiny"
            ariaLabel={lang('Back')}
            onClick={handleBackClick}
            iconName="arrow-left"
          />
        ) : (
          <Button
            round
            color="translucent"
            size="tiny"
            ariaLabel={lang('Close')}
            onClick={handleCloseClick}
            iconName="close"
          />
        )}
        <div className={buildClassName('modal-title', styles.modalTitle, hasSubtitle && styles.titleMultiline)}>
          <h3 className={buildClassName(styles.title, renderingDepth && styles.hasDepth)}>
            {renderingSection?.options
              ? lang(modal?.subject === 'story' ? 'ReportStory' : 'Report') : renderingSection?.title}
          </h3>
          {hasSubtitle && (
            <span className={styles.subtitle}>{renderingSection.subtitle}</span>
          )}
        </div>
      </div>
    );
  }, [lang, modal, renderingDepth, renderingSection?.options, renderingSection?.subtitle, renderingSection?.title]);

  const handleTextChange = useLastCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  });

  useEffect(() => {
    if (!modal) return;
    const slide = document.querySelector<HTMLElement>(`.${ACTIVE_SLIDE_CLASS_NAME} > .${styles.slide}`);
    if (!slide) return;

    const height = slide.scrollHeight;
    requestMutation(() => {
      transitionRef.current!.style.height = `${height}px`;
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

  const closeReportMessageModalHandler = useLastCallback(() => {
    setText('');
    closeReportModal();
  });

  const sendMessageReportHandler = useLastCallback(() => {
    const {
      messageIds, subject, peerId, chatId,
    } = modal!;
    switch (subject) {
      case 'message':
        reportMessages({
          chatId: chatId!, messageIds, option: renderingSection?.option, description: text,
        });
        break;
      case 'story':
        reportStory({
          storyId: messageIds?.[0], peerId: peerId!, option: renderingSection?.option, description: text,
        });
        break;
    }
    closeReportMessageModalHandler();
  });

  return (
    <Modal
      isOpen={isOpen}
      header={header}
      onClose={closeReportMessageModalHandler}
      contentClassName={styles.content}
      className={buildClassName(styles.root, modal?.subject === 'story' && 'component-theme-dark')}
    >
      <Transition
        name="slide"
        className={styles.transition}
        ref={transitionRef}
        activeKey={renderingDepth}
        onStart={handleAnimationStart}
      >
        <div className={styles.slide}>
          {renderingSection?.options
            ? <h3 className={styles.sectionTitle}>{renderingSection?.title}</h3> : undefined}
          {renderingSection?.options?.map((option) => (
            <ListItem
              narrow
              nonInteractive
              secondaryIcon="next"
              className={styles.option}
              buttonClassName={styles.optionButton}
              clickArg={option.option}
              onClick={handleOptionClick}
            >
              <div className={styles.optionText}>{option.text}</div>
            </ListItem>
          ))}
          {renderingSection?.option ? (
            <div className={styles.block}>
              <AnimatedIconWithPreview
                tgsUrl={LOCAL_TGS_URLS.Report}
                size={100}
                className={styles.reportIcon}
                nonInteractive
                forceAlways
                noLoop={false}
              />
              <TextArea
                id="option"
                className={styles.optionInfo}
                label={renderingSection.isOptional ? lang('Report2CommentOptional') : lang('Report2Comment')}
                onChange={handleTextChange}
                value={text}
                maxLength={MAX_DESCRIPTION}
                maxLengthIndicator={(MAX_DESCRIPTION - text.length).toString()}
                noReplaceNewlines
              />
              <Button
                onClick={sendMessageReportHandler}
                disabled={!renderingSection.isOptional ? !text.length : undefined}
              >
                {lang('ReportSend')}
              </Button>
            </div>
          ) : undefined}
        </div>
      </Transition>
    </Modal>
  );
};

export default memo(ReportModal);
