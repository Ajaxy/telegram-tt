import type { TeactNode } from '../../../../lib/teact/teact';
import { memo, useLayoutEffect, useRef, useState } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import { requestMeasure } from '../../../../lib/fasterdom/fasterdom';
import buildClassName from '../../../../util/buildClassName';
import { copyTextToClipboard } from '../../../../util/clipboard';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import Button from '../../../ui/Button';
import Link from '../../../ui/Link';
import TextLoadingPlaceholder from '../../../ui/placeholder/TextLoadingPlaceholder';
import Transition from '../../../ui/Transition';

import styles from './AiEditorShared.module.scss';

const MIN_HEIGHT = 100;
const HEIGHT_PADDING = 4;

type AiEditorResultAreaProps = {
  isLoading?: boolean;
  transitionKey?: number;
  className?: string;
  children: TeactNode;
};

export const AiEditorResultArea = memo(({
  isLoading,
  transitionKey,
  className,
  children,
}: AiEditorResultAreaProps) => {
  const contentRef = useRef<HTMLDivElement>();
  const [height, setHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    if (isLoading || !contentRef.current) return;

    requestMeasure(() => {
      if (!contentRef.current) return;
      const newHeight = contentRef.current.scrollHeight + HEIGHT_PADDING;
      setHeight(newHeight);
    });
  }, [children, isLoading, transitionKey]);

  const displayHeight = height ?? MIN_HEIGHT;

  return (
    <div
      className={buildClassName(styles.resultArea, className)}
      style={`height: ${displayHeight}px`}
    >
      <div className={buildClassName(styles.loadingContainer, !isLoading && styles.hidden)}>
        <TextLoadingPlaceholder lines={6} />
      </div>
      <Transition
        name="fade"
        activeKey={transitionKey ?? 0}
        className={buildClassName(styles.resultTransition, isLoading && styles.hidden)}
      >
        <div ref={contentRef} className={styles.resultContent}>
          {children}
        </div>
      </Transition>
    </div>
  );
});

type AiEditorErrorMessageProps = {
  error?: 'floodPremium' | 'aiError' | 'generic';
  isPremium?: boolean;
};

export const AiEditorErrorMessage = memo(({
  error,
  isPremium,
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
    </div>
  );
});

type AiEditorCopyButtonProps = {
  textToCopy?: string;
  isHidden?: boolean;
  className?: string;
};

export const AiEditorCopyButton = memo(({
  textToCopy,
  isHidden,
  className,
}: AiEditorCopyButtonProps) => {
  const { showNotification } = getActions();
  const lang = useLang();

  const handleCopy = useLastCallback(() => {
    if (textToCopy) {
      copyTextToClipboard(textToCopy);
      showNotification({ message: { key: 'TextCopied' } });
    }
  });

  return (
    <Button
      className={buildClassName(styles.copyButton, isHidden && styles.hidden, className)}
      round
      size="tiny"
      color="translucent-primary"
      iconName="copy"
      ariaLabel={lang('Copy')}
      onClick={handleCopy}
    />
  );
});
