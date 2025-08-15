import type { FC } from '../../lib/teact/teact';
import { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import { LOCAL_TGS_PREVIEW_URLS, LOCAL_TGS_URLS } from './helpers/animatedAssets';
import renderText from './helpers/renderText';

import useOldLang from '../../hooks/useOldLang';
import useShowTransitionDeprecated from '../../hooks/useShowTransitionDeprecated';

import AnimatedIconWithPreview from './AnimatedIconWithPreview';

import './NothingFound.scss';

interface OwnProps {
  text?: string;
  description?: string;
  withSticker?: boolean;
}

const DEFAULT_TEXT = 'Nothing found.';

const NothingFound: FC<OwnProps> = ({ text = DEFAULT_TEXT, description, withSticker }) => {
  const lang = useOldLang();
  const { transitionClassNames } = useShowTransitionDeprecated(true);

  return (
    <div className={buildClassName(
      'NothingFound',
      transitionClassNames,
      description && 'with-description',
      withSticker && 'with-sticker')}
    >
      {withSticker && (
        <AnimatedIconWithPreview
          className="sticker"
          size={120}
          tgsUrl={LOCAL_TGS_URLS.DuckNothingFound}
          previewUrl={LOCAL_TGS_PREVIEW_URLS.DuckNothingFound}
          nonInteractive
          noLoop={false}
        />
      )}
      {text}
      {description && <p className="description">{renderText(lang(description), ['br'])}</p>}
    </div>
  );
};

export default memo(NothingFound);
