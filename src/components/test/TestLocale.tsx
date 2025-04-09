import React from '../../lib/teact/teact';

import type { LangFnParameters } from '../../util/localization';

import useLang from '../../hooks/useLang';

const storedParameter: LangFnParameters = {
  key: 'StickerPackAddStickerCount',
  variables: {
    count: 42,
  },
  options: {
    pluralValue: 42,
  },
};

const storedAdvancedParameter: LangFnParameters = {
  key: 'VoipPeerIncompatible',
  variables: {
    user: 'Some user',
  },
  options: {
    withNodes: true,
    withMarkdown: true,
  },
};

const TestLocale = () => {
  const lang = useLang();

  return (
    <div>
      <h1>{lang('NothingFound')}</h1>
      <p>{lang.with(storedParameter)}</p>
      <p>{lang.with(storedAdvancedParameter)}</p>
      <p>
        {lang('LimitReachedChatInFolders', {
          limit: 'first limit',
          limit2: 'second limit',
        }, {
          withNodes: true,
          withMarkdown: true,
        })}
      </p>
      <p>{lang('Participants', { count: 42 }, { pluralValue: 42 })}</p>
      <p>
        {lang('ActionPinnedText', {
          text: 'Some message',
          from: 'Some user',
        })}
      </p>
      {/* <p>
        {lang('LocalTestString', {
          link: <a href="https://google.com">this link</a>,
          secondLink: <a href="https://google.com">this second link</a>,
          user: lang.disjunction(['Some __tricky__ user', 'Another user', 'Third user']),
        }, {
          withNodes: true,
          withMarkdown: true,
          specialReplacement: {
            '⚡': <Icon name="boost" />,
          },
        })}
      </p> */}
    </div>
  );
};

export default TestLocale;
