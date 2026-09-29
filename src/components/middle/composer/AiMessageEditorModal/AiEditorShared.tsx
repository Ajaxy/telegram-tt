import type { TeactNode } from '../../../../lib/teact/teact';
import { memo, useLayoutEffect, useMemo, useRef, useState } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { AiEditorContent, AiEditorResult } from '../../../../global/types';

import { requestMeasure } from '../../../../lib/fasterdom/fasterdom';
import { selectTheme } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { copyTextToClipboardFromPromise } from '../../../../util/clipboard';
import { serializeMessageCopyTiptapJson } from '../../../../util/tiptap/messageCopy';
import { renderTextWithEntities } from '../../../common/helpers/renderTextWithEntities';
import { buildRichMessageFromFormatted, buildTiptapJsonFromRichMessage } from '../../../ui/textInput/richText';

import useSelector from '../../../../hooks/data/useSelector';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useResizeObserver from '../../../../hooks/useResizeObserver';

import RichContent from '../../../iv/RichContent';
import Button from '../../../ui/Button';
import Link from '../../../ui/Link';
import TextLoadingPlaceholder from '../../../ui/placeholder/TextLoadingPlaceholder';
import Transition from '../../../ui/Transition';

import styles from './AiEditorShared.module.scss';

const MIN_HEIGHT = 100;
const HEIGHT_PADDING = 4;
const LOADING_LINES = 6;

export function getAiEditorText(content: AiEditorContent) {
  if (content.type === 'text') return content.text.text;
  return serializeMessageCopyTiptapJson(
    buildTiptapJsonFromRichMessage(content.richMessage, { isForCopy: true }),
  ).plainText;
}

export const AiEditorPreview = memo(({ content, shouldShowDiff }: {
  content?: AiEditorResult;
  shouldShowDiff?: boolean;
}) => {
  const theme = useSelector(selectTheme);

  return (
    <div className={styles.preview}>
      {content?.type === 'rich' ? (
        <RichContent
          blocks={content.richMessage.blocks}
          isRtl={content.richMessage.isRtl}
          theme={theme}
          noPlaylist
        />
      ) : content && renderTextWithEntities(shouldShowDiff && content.diffText ? content.diffText : content.text)}
    </div>
  );
});

type AiEditorResultAreaProps = {
  isLoading?: boolean;
  transitionKey?: number;
  className?: string;
  loadingElement?: TeactNode;
  children: TeactNode;
};

export const AiEditorResultArea = memo(({
  isLoading,
  transitionKey,
  className,
  loadingElement,
  children,
}: AiEditorResultAreaProps) => {
  const [height, setHeight] = useState<number | undefined>(undefined);

  const hasInitialized = height !== undefined;
  const displayHeight = isLoading ? Math.max(height ?? 0, MIN_HEIGHT) : height;

  return (
    <div
      className={buildClassName(styles.resultArea, hasInitialized && styles.resultAreaAnimated, className)}
      style={displayHeight !== undefined ? `height: ${displayHeight}px` : undefined}
    >
      <div className={buildClassName(styles.loadingContainer, !isLoading && styles.hidden)}>
        {loadingElement || <TextLoadingPlaceholder lines={LOADING_LINES} />}
      </div>
      <Transition
        name="fade"
        activeKey={transitionKey ?? 0}
        className={buildClassName(styles.resultTransition, isLoading && styles.hidden)}
      >
        {(isActive) => (
          <AiEditorResultContent isActive={isActive} isLoading={isLoading} onHeightChange={setHeight}>
            {children}
          </AiEditorResultContent>
        )}
      </Transition>
    </div>
  );
});

const AiEditorResultContent = ({ isActive, isLoading, children, onHeightChange }: {
  isActive: boolean;
  isLoading?: boolean;
  children: TeactNode;
  onHeightChange: (height: number) => void;
}) => {
  const contentRef = useRef<HTMLDivElement>();
  const updateHeight = useLastCallback(() => {
    if (!isActive || isLoading) return;
    requestMeasure(() => {
      if (contentRef.current) onHeightChange(contentRef.current.scrollHeight + HEIGHT_PADDING);
    });
  });
  useResizeObserver(contentRef, updateHeight, !isActive || isLoading);
  useLayoutEffect(() => {
    updateHeight();
  }, [children, isActive, isLoading, updateHeight]);

  return <div ref={contentRef} className={styles.resultContent}>{children}</div>;
};

type AiEditorErrorMessageProps = {
  error?: 'floodPremium' | 'aiError' | 'generic';
  isPremium?: boolean;
  onRetry?: NoneToVoidFunction;
};

export const AiEditorErrorMessage = memo(({
  error,
  isPremium,
  onRetry,
}: AiEditorErrorMessageProps) => {
  const { openPremiumModal } = getActions();
  const lang = useLang();

  const handleOpenPremiumModal = useLastCallback(() => {
    openPremiumModal({ initialSection: 'ai_compose' });
  });

  if (!error) return undefined;

  const isFloodError = error === 'floodPremium';

  return (
    <div className={styles.errorMessage}>
      {isFloodError ? (
        isPremium
          ? lang('AiMessageEditorDailyLimitReachedPremium')
          : lang('AiMessageEditorDailyLimitReached', {
            link: (
              <Link isPrimary onClick={handleOpenPremiumModal}>
                {lang('TelegramPremium')}
              </Link>
            ),
          }, { withNodes: true })
      ) : lang('AiMessageEditorGenericError')}
      {!isFloodError && onRetry && (
        <>
          {' '}
          <Link isPrimary onClick={onRetry}>{lang('Retry')}</Link>
        </>
      )}
    </div>
  );
});

type AiEditorCopyButtonProps = {
  content?: AiEditorContent;
  isHidden?: boolean;
  className?: string;
};

export const AiEditorCopyButton = memo(({
  content,
  isHidden,
  className,
}: AiEditorCopyButtonProps) => {
  const { showNotification } = getActions();
  const lang = useLang();

  const copyContent = useMemo(() => content ? serializeMessageCopyTiptapJson(buildTiptapJsonFromRichMessage(
    content.type === 'rich' ? content.richMessage : buildRichMessageFromFormatted(content.text),
    { isForCopy: true },
  )) : undefined, [content]);

  const handleCopy = useLastCallback(() => {
    if (!copyContent?.plainText) return;
    void copyTextToClipboardFromPromise(
      Promise.resolve(copyContent),
      () => showNotification({ message: { key: 'TextCopied' } }),
      () => showNotification({ message: { key: 'GeneralError' } }),
    );
  });

  return (
    <Button
      className={buildClassName(styles.copyButton, (isHidden || !copyContent?.plainText) && styles.hidden, className)}
      round
      size="tiny"
      color="translucent-primary"
      iconName="copy"
      ariaLabel={lang('Copy')}
      onClick={handleCopy}
    />
  );
});
