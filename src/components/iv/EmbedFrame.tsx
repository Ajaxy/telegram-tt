import { memo, useEffect, useMemo, useRef, useState } from '../../lib/teact/teact';

import type { ApiPageBlockEmbed } from '../../api/types';

import { EMBED_ALLOW_ATTRIBUTES, IFRAME_SANDBOX_ATTRIBUTES, isMessageFromIframe } from '../../util/browser/iframe';
import buildStyle from '../../util/buildStyle';
import { extractInstantViewEmbedUrl } from '../../util/instantViewEmbed';

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
        const data: unknown = JSON.parse(event.data);
        if (!isEmbedFrameEvent(data)) {
          return;
        }

        switch (data.eventType) {
          case 'resize_frame': {
            const nextHeight = data.eventData.height;
            if (!nextHeight || typeof nextHeight !== 'number') return;

            setFrameHeight(nextHeight);
            break;
          }
          default:
            break;
        }
      } catch (err) {
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

function isEmbedFrameEvent(data: unknown): data is EmbedFrameEvent {
  return isRecord(data) && typeof data.eventType === 'string';
}

function isRecord(data: unknown): data is Record<string, unknown> {
  return Boolean(data) && typeof data === 'object';
}
