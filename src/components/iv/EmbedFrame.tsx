import { memo, useEffect, useMemo, useRef, useState } from '../../lib/teact/teact';

import type { ApiPageBlockEmbed } from '../../api/types';

import { EMBED_ALLOW_ATTRIBUTES, IFRAME_SANDBOX_ATTRIBUTES, isMessageFromIframe } from '../../util/browser/iframe';
import buildStyle from '../../util/buildStyle';
import { extractInstantViewEmbedUrl } from '../../util/instantViewEmbed';
import { isLiteralObject } from '../../util/iteratees';

import styles from './RichContent.module.scss';

type OwnProps = {
  block: ApiPageBlockEmbed;
  title: string;
};

type EmbedFrameResizeEvent = {
  eventType: 'resize_frame';
  eventData: {
    height: number;
  };
};

type EmbedFrameEvent = EmbedFrameResizeEvent;

const EmbedFrame = ({ block, title }: OwnProps) => {
  const frameRef = useRef<HTMLIFrameElement>();
  const [frameHeight, setFrameHeight] = useState<number>();

  const embedUrl = useMemo(() => {
    return block.url || extractInstantViewEmbedUrl(block.html!);
  }, [block.html, block.url]);

  useEffect(() => {
    function handleMessage(event: MessageEvent<string>) {
      if (!isMessageFromIframe(event, frameRef.current)) {
        return;
      }

      try {
        const parsed: unknown = JSON.parse(event.data);
        const data = parseEmbedFrameEvent(parsed);
        if (!data) {
          return;
        }

        switch (data.eventType) {
          case 'resize_frame': {
            setFrameHeight(data.eventData.height);
            break;
          }
          default:
            break;
        }
      } catch {
        // Ignore other messages
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  if (!embedUrl) {
    return undefined;
  }

  const height = frameHeight || block.height;
  const style = buildStyle(
    block.width !== undefined && `width: ${block.width}px`,
    height !== undefined && `height: ${height}px`,
  );

  return (
    <iframe
      ref={frameRef}
      className={styles.embedFrame}
      src={embedUrl}
      title={title}
      sandbox={IFRAME_SANDBOX_ATTRIBUTES}
      allow={EMBED_ALLOW_ATTRIBUTES}
      allowFullScreen
      scrolling={block.shouldAllowScrolling ? 'yes' : 'no'}
      style={style}
    />
  );
};

export default memo(EmbedFrame);

function parseEmbedFrameEvent(data: unknown): EmbedFrameEvent | undefined {
  if (!isLiteralObject(data)) {
    return undefined;
  }

  switch (data.eventType) {
    case 'resize_frame': {
      const height = data.eventData?.height;
      if (typeof height !== 'number' || !Number.isFinite(height) || height <= 0) {
        return undefined;
      }

      return {
        eventType: 'resize_frame',
        eventData: { height },
      };
    }
    default:
      return undefined;
  }
}
