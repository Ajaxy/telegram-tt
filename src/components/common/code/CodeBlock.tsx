import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback, useState } from '../../../lib/teact/teact';

import { ApiMessageEntityTypes } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import { getPrettyCodeLanguageName } from '../../../util/prettyCodeLanguageNames';

import useAsync from '../../../hooks/useAsync';

import CodeOverlay from './CodeOverlay';

import './CodeBlock.scss';

export type OwnProps = {
  text: string;
  language?: string;
  noCopy?: boolean;
};

const CodeBlock: FC<OwnProps> = ({ text, language, noCopy }) => {
  const [isWordWrap, setWordWrap] = useState(true);

  const { result: highlighted } = useAsync(() => {
    if (!language) return Promise.resolve(undefined);
    return import('../../../util/highlightCode')
      .then((lib) => lib.default(text, language));
  }, [language, text]);

  const handleWordWrapToggle = useCallback((wrap) => {
    setWordWrap(wrap);
  }, []);

  const blockClass = buildClassName(
    'code-block',
    !isWordWrap && 'no-word-wrap',
  );

  return (
    <div className="CodeBlock">
      {language && (<p className="code-title">{getPrettyCodeLanguageName(language)}</p>)}
      <pre className={blockClass} data-entity-type={ApiMessageEntityTypes.Pre} data-language={language}>
        {highlighted ?? text}
        <CodeOverlay
          text={text}
          className="code-overlay"
          onWordWrapToggle={handleWordWrapToggle}
          noCopy={noCopy}
        />
      </pre>
    </div>
  );
};

export default memo(CodeBlock);
