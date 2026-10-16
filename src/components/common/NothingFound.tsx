import { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import { LOCAL_TGS_PREVIEW_URLS, LOCAL_TGS_URLS } from './helpers/animatedAssets';
import renderText from './helpers/renderText';

import useLang from '../../hooks/useLang';
import useShowTransitionDeprecated from '../../hooks/useShowTransitionDeprecated';

import AnimatedIconWithPreview from './AnimatedIconWithPreview';

import './NothingFound.scss';

interface OwnProps {
  text?: string;
  description?: string;
  withSticker?: boolean;
  className?: string;
}

const NothingFound = ({
  text, description, withSticker, className,
}: OwnProps) => {
  const lang = useLang();
  const { transitionClassNames } = useShowTransitionDeprecated(true);

  return (
    <div className={buildClassName(
      'NothingFound',
      className,
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
      {text ?? lang('NothingFound')}
      {description && <p className="description">{renderText(description, ['br'])}</p>}
    </div>
  );
};

export default memo(NothingFound);
