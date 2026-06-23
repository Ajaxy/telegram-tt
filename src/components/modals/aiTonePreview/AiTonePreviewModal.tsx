import { memo, useMemo, useRef, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiUser } from '../../../api/types';
import type { TabState } from '../../../global/types';

import { selectUser } from '../../../global/selectors';
import { getInputTone } from '../../../util/aiComposeTones';
import calcTextLineHeightAndCount from '../../../util/element/calcTextLineHeightAndCount';
import formatUsername from '../../common/helpers/formatUsername';
import { renderTextWithEntities } from '../../common/helpers/renderTextWithEntities';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import CustomEmoji from '../../common/CustomEmoji';
import Icon from '../../common/icons/Icon';
import { AiEditorResultArea } from '../../middle/composer/AiMessageEditorModal/AiEditorShared';
import Button from '../../ui/Button';
import Link from '../../ui/Link';
import TextLoadingPlaceholder from '../../ui/placeholder/TextLoadingPlaceholder';
import Modal, { ModalCloseButton, ModalHeader } from '@gili/modal/Modal';

import sharedStyles from '../../middle/composer/AiMessageEditorModal/AiEditorShared.module.scss';
import styles from './AiTonePreviewModal.module.scss';

const DEFAULT_MAX_EXAMPLES = 3;
const DEFAULT_LINES = 4;
const EMOJI_SIZE = 48;

export type OwnProps = {
  modal: TabState['aiTonePreviewModal'];
};

type StateProps = {
  author?: ApiUser;
  maxExamples?: number;
};

const AiTonePreviewModal = ({ modal, author, maxExamples = DEFAULT_MAX_EXAMPLES }: OwnProps & StateProps) => {
  const {
    closeAiTonePreview,
    saveAiTone,
    loadAiTonePreviewExample,
    openChat,
  } = getActions();

  const lang = useLang();

  const isOpen = Boolean(modal);
  const tone = modal?.tone;
  const example = modal?.example;
  const isAlreadyAdded = modal?.isAlreadyAdded;
  const slug = modal?.slug;
  const hasExampleError = modal?.hasExampleError;

  const [exampleNum, setExampleNum] = useState(0);
  const spinCountRef = useRef(0);
  const beforeRef = useRef<HTMLDivElement>();
  const afterRef = useRef<HTMLDivElement>();
  const prevLinesRef = useRef({ before: DEFAULT_LINES, after: DEFAULT_LINES });

  const handleClose = useLastCallback(() => {
    closeAiTonePreview();
    setExampleNum(0);
    spinCountRef.current = 0;
    prevLinesRef.current = { before: DEFAULT_LINES, after: DEFAULT_LINES };
  });

  const handleAdd = useLastCallback(() => {
    if (!tone) return;
    saveAiTone({ tone: getInputTone(tone) });
  });

  const handleRemove = useLastCallback(() => {
    if (!tone) return;
    saveAiTone({ tone: getInputTone(tone), unsave: true });
  });

  const handleAnotherExample = useLastCallback(() => {
    if (!slug) return;

    if (beforeRef.current && afterRef.current) {
      prevLinesRef.current = {
        before: Math.max(DEFAULT_LINES, calcTextLineHeightAndCount(beforeRef.current).totalLines),
        after: Math.max(DEFAULT_LINES, calcTextLineHeightAndCount(afterRef.current).totalLines),
      };
    }

    const nextNum = (exampleNum + 1) % maxExamples;
    spinCountRef.current += 1;
    setExampleNum(nextNum);
    loadAiTonePreviewExample({
      tone: { type: 'slug', slug },
      num: nextNum,
    });
  });

  const handleAuthorClick = useLastCallback(() => {
    if (!tone?.authorId) return;
    handleClose();
    openChat({ id: tone.authorId });
  });

  const renderHeader = useMemo(() => (
    <ModalHeader>
      <ModalCloseButton />
    </ModalHeader>
  ), []);

  function renderFooterInfo() {
    if (!tone) return undefined;

    const installsCount = tone.installsCount || 0;
    const authorName = author?.usernames?.[0]?.username;

    if (!installsCount && !authorName) return undefined;

    const authorLink = authorName
      ? <Link isPrimary onClick={handleAuthorClick}>{formatUsername(authorName)}</Link>
      : undefined;

    const usedByText = installsCount
      ? lang('AiTonePreviewUsedBy2', { count: lang.number(installsCount) }, { pluralValue: installsCount })
      : undefined;
    const createdByText = authorLink
      ? lang('AiTonePreviewCreatedBy', { author: authorLink }, { withNodes: true })
      : undefined;

    if (usedByText && createdByText) {
      return (
        <div className={styles.info}>
          {lang('AiTonePreviewUsedByCreatedBy', {
            usedBy: usedByText,
            createdBy: createdByText,
          }, { withNodes: true })}
        </div>
      );
    }

    return (
      <div className={styles.info}>
        {usedByText || createdByText}
      </div>
    );
  }

  const { before: beforeLines, after: afterLines } = prevLinesRef.current;

  const exampleLoadingElement = useMemo(() => (
    <>
      <TextLoadingPlaceholder lines={beforeLines} className={styles.skeletonBefore} />
      <div className={sharedStyles.separator} />
      <div className={sharedStyles.labelRow}>
        <span className={sharedStyles.label}>{lang('AiTonePreviewAfter')}</span>
      </div>
      <TextLoadingPlaceholder lines={afterLines} className={styles.skeletonAfter} />
    </>
  ), [lang, beforeLines, afterLines]);

  function renderExampleContent() {
    if (hasExampleError) {
      return (
        <div className={sharedStyles.errorMessage}>
          {lang('AiMessageEditorGenericError')}
        </div>
      );
    }

    if (!example) return undefined;

    return (
      <>
        <div ref={beforeRef} className={sharedStyles.resultContent}>
          {renderTextWithEntities(example.from)}
        </div>
        <div className={sharedStyles.separator} />
        <div className={sharedStyles.labelRow}>
          <span className={sharedStyles.label}>{lang('AiTonePreviewAfter')}</span>
        </div>
        <div ref={afterRef} className={sharedStyles.resultContent}>
          {renderTextWithEntities(example.to)}
        </div>
      </>
    );
  }

  const renderFooter = useMemo(() => {
    if (!tone) return undefined;
    return (
      <div className={styles.footer}>
        {isAlreadyAdded ? (
          <Button
            className={styles.addButton}
            onClick={tone.isCreator ? handleClose : handleRemove}
            color={tone.isCreator ? undefined : 'danger'}
            isText={!tone.isCreator}
            noForcedUpperCase
          >
            {lang(tone.isCreator ? 'Done' : 'AiTonePreviewRemoveStyle')}
          </Button>
        ) : (
          <Button
            className={styles.addButton}
            onClick={handleAdd}
          >
            {lang('AiTonePreviewAddStyle')}
          </Button>
        )}
      </div>
    );
  }, [tone, isAlreadyAdded, lang, handleClose, handleRemove, handleAdd]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      header={renderHeader}
      stickyFooter={renderFooter}
      dialogClassName={styles.modal}
      width="slim"
      height="regular"
    >
      {tone && (
        <>
          {tone.emojiId && (
            <div className={styles.emojiRow}>
              <div className={styles.emojiCircle}>
                <CustomEmoji documentId={tone.emojiId} size={EMOJI_SIZE} />
              </div>
            </div>
          )}

          <div className={styles.title}>{tone.title}</div>
          <div className={styles.subtitle}>{lang('AiTonePreviewSubtitle')}</div>

          <div className={styles.exampleWrapper}>
            <div className={sharedStyles.labelRow}>
              <span className={sharedStyles.label}>{lang('AiTonePreviewBefore')}</span>
              <button
                type="button"
                className={styles.anotherExampleButton}
                onClick={handleAnotherExample}
              >
                <Icon
                  name="reload-arrows"
                  className={styles.anotherExampleIcon}
                  style={`transform: rotate(${spinCountRef.current * 180}deg)`}
                />
                {lang('AiTonePreviewAnotherExample')}
              </button>
            </div>
            <AiEditorResultArea
              isLoading={!example && !hasExampleError}
              transitionKey={exampleNum}
              loadingElement={exampleLoadingElement}
            >
              {renderExampleContent()}
            </AiEditorResultArea>
          </div>

          {renderFooterInfo()}
        </>
      )}
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => {
    const authorId = modal?.tone?.authorId;
    return {
      author: authorId ? selectUser(global, authorId) : undefined,
      maxExamples: global.appConfig.aiComposeToneExamplesNum,
    };
  },
)(AiTonePreviewModal));
