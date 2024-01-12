import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import buildClassName from '../../../util/buildClassName';
import { copyTextToClipboard } from '../../../util/clipboard';
import { areLinesWrapping } from '../helpers/renderText';

import useLang from '../../../hooks/useLang';
import useWindowSize from '../../../hooks/window/useWindowSize';

import styles from './CodeOverlay.module.scss';

export type OwnProps = {
  className?: string;
  text: string;
  noCopy?: boolean;
  onWordWrapToggle?: (wrap: boolean) => void;
};

const CodeOverlay: FC<OwnProps> = ({
  text, className, noCopy, onWordWrapToggle,
}) => {
  const { showNotification } = getActions();
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  const windowSize = useWindowSize();
  const lang = useLang();
  const [isWordWrap, setIsWordWrap] = useState(true);
  const [withWordWrapButton, setWithWordWrapButton] = useState(false);

  const checkWordWrap = useCallback(() => {
    const isWrap = areLinesWrapping(text, ref.current!.parentElement!);
    setWithWordWrapButton(isWrap);
  }, [text]);

  useEffect(() => {
    if (isWordWrap) {
      checkWordWrap();
    }
  }, [checkWordWrap, isWordWrap, text, windowSize]);

  const handleCopy = useCallback(() => {
    copyTextToClipboard(text);
    showNotification({
      message: lang('TextCopied'),
    });
  }, [lang, showNotification, text]);

  const handleWordWrapClick = useCallback(() => {
    setIsWordWrap(!isWordWrap);
    onWordWrapToggle?.(!isWordWrap);
  }, [isWordWrap, onWordWrapToggle]);

  const contentClass = buildClassName(styles.content, !withWordWrapButton && noCopy && styles.hidden);
  const overlayClass = buildClassName(styles.overlay, className);
  const wrapClass = buildClassName(styles.wrap, isWordWrap && styles.wrapOn);

  return (
    <div className={overlayClass} ref={ref}>
      <div className={contentClass}>
        {withWordWrapButton && (
          <div className={wrapClass} onClick={handleWordWrapClick} title="Word Wrap">
            <i className="icon icon-word-wrap" />
          </div>
        )}
        {!noCopy && (
          <div className={styles.copy} onClick={handleCopy} title={lang('Copy')}>
            <i className="icon icon-copy" />
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(CodeOverlay);
