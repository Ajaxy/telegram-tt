import { memo, useRef } from '../../../../lib/teact/teact';

import type { ApiWallpaper } from '../../../../api/types';
import type { ObserveFn } from '../../../../hooks/useIntersectionObserver';

import buildClassName from '../../../../util/buildClassName';

import useFlag from '../../../../hooks/useFlag';
import { useOnIntersect } from '../../../../hooks/useIntersectionObserver';
import useMedia from '../../../../hooks/useMedia';

import backgroundStyles from '../../../../styles/_patternBackground.module.scss';
import styles from '../ActionMessage.module.scss';

type OwnProps = {
  wallpaper: ApiWallpaper;
  observeIntersection?: ObserveFn;
};

const WallpaperPreview = ({ wallpaper, observeIntersection }: OwnProps) => {
  const ref = useRef<HTMLDivElement>();
  const [isLoadAllowed, allowLoad] = useFlag(!observeIntersection);
  useOnIntersect(ref, !isLoadAllowed ? observeIntersection : undefined, (entry) => {
    if (entry.isIntersecting) allowLoad();
  });

  const mediaUrl = useMedia(`wallpaper${wallpaper.document!.id}`, !isLoadAllowed);

  return (
    <div
      ref={ref}
      className={styles.wallpaperPreview}
      aria-hidden
    >
      {mediaUrl && (
        <div
          className={buildClassName(
            backgroundStyles.background,
            backgroundStyles.customBgImage,
            wallpaper.settings?.isBlurred && backgroundStyles.blurred,
          )}
          style={`--custom-background: url(${mediaUrl})`}
        />
      )}
    </div>
  );
};

export default memo(WallpaperPreview);
