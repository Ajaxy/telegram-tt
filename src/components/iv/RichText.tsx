import type { ElementRef, TeactNode } from '../../lib/teact/teact';

import type { ApiMessageEntityFormattedDate, ApiRichText } from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { ThreadId } from '../../types';
import { ApiMessageEntityTypes } from '../../api/types';

import { DEBUG } from '../../config';
import { requestMeasure, requestMutation } from '../../lib/fasterdom/fasterdom';
import { getNestedRichText, getRichTextPlainText } from '../../global/helpers/richMessage';
import buildClassName from '../../util/buildClassName';
import renderText from '../common/helpers/renderText';

import CustomEmoji from '../common/CustomEmoji';
import FormattedDate from '../common/FormattedDate';
import SafeLink from '../common/SafeLink';
import Spoiler from '../common/spoiler/Spoiler';
import MentionLink from '../middle/message/MentionLink';
import InlineImage from './InlineImage';
import Latex from './Latex';

import styles from './RichContent.module.scss';

type OwnProps = {
  text: ApiRichText;
  unsupportedText: string;
  containerId: string;
  pageUrl?: string;
  chatId?: string;
  messageId?: number;
  threadId?: ThreadId;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  sharedCanvasRef?: ElementRef<HTMLCanvasElement>;
  sharedCanvasHqRef?: ElementRef<HTMLCanvasElement>;
};

const RichText = ({
  text,
  unsupportedText,
  containerId,
  pageUrl,
  chatId,
  messageId,
  threadId,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  sharedCanvasRef,
  sharedCanvasHqRef,
}: OwnProps): TeactNode => {
  switch (text.type) {
    case 'empty':
      return undefined;
    case 'plain':
      return renderText(text.text, ['emoji', 'br']);
    case 'concat':
      return text.texts.map((part, index) => (
        <RichText
          key={index}
          text={part}
          unsupportedText={unsupportedText}
          containerId={containerId}
          pageUrl={pageUrl}
          chatId={chatId}
          messageId={messageId}
          threadId={threadId}
          observeIntersectionForLoading={observeIntersectionForLoading}
          observeIntersectionForPlaying={observeIntersectionForPlaying}
          sharedCanvasRef={sharedCanvasRef}
          sharedCanvasHqRef={sharedCanvasHqRef}
        />
      ));
    case 'bold':
      return <strong>{renderNestedText()}</strong>;
    case 'italic':
      return <em>{renderNestedText()}</em>;
    case 'underline':
      return <ins>{renderNestedText()}</ins>;
    case 'strike':
      return <del>{renderNestedText()}</del>;
    case 'fixed':
      return <code className={buildClassName('text-entity-code', styles.inlineCode)}>{renderNestedText()}</code>;
    case 'url': {
      const textContent = getRichTextPlainText(text.text);
      const localAnchor = getLocalPageAnchor(text.url, containerId, pageUrl);
      const className = buildClassName('text-entity-link', text.webPageId && !localAnchor && styles.previewLink);
      if (localAnchor) {
        return (
          <a
            href={localAnchor.href}
            className={className}
            dir="auto"
            data-entity-type={ApiMessageEntityTypes.TextUrl}
            data-anchor-id={localAnchor.targetId}
            onClick={handleLocalAnchorClick}
          >
            {renderNestedText()}
          </a>
        );
      }

      const url = resolvePageUrl(text.url, pageUrl);

      return (
        <SafeLink
          url={url}
          text={textContent}
          className={className}
          chatId={chatId}
          messageId={messageId}
          threadId={threadId}
          previewId={text.webPageId}
          tryInstantView
          entityType={ApiMessageEntityTypes.TextUrl}
        >
          {renderNestedText()}
        </SafeLink>
      );
    }
    case 'email':
      return (
        <a
          href={`mailto:${text.email}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-entity-link"
          dir="auto"
        >
          {renderNestedText()}
        </a>
      );
    case 'subscript':
      return <sub className={styles.subscript}>{renderNestedText()}</sub>;
    case 'superscript':
      return <sup className={styles.superscript}>{renderNestedText()}</sup>;
    case 'marked':
      return <mark className={styles.markedText}>{renderNestedText()}</mark>;
    case 'phone':
      return (
        <a
          href={`tel:${text.phone}`}
          className="text-entity-link"
          dir="auto"
        >
          {renderNestedText()}
        </a>
      );
    case 'anchor':
      return <span id={getPageAnchorId(containerId, text.name)}>{renderNestedText()}</span>;
    case 'customEmoji':
      return renderCustomEmoji(text);
    case 'spoiler':
      return <Spoiler containerId={containerId}>{renderNestedText()}</Spoiler>;
    case 'mention':
      return <MentionLink username={getRichTextPlainText(text.text)}>{renderNestedText()}</MentionLink>;
    case 'mentionName':
      return <MentionLink userId={text.userId}>{renderNestedText()}</MentionLink>;
    case 'autoUrl': {
      const url = getRichTextPlainText(text.text);
      return (
        <SafeLink
          url={url}
          text={url}
          chatId={chatId}
          messageId={messageId}
          threadId={threadId}
          entityType={ApiMessageEntityTypes.Url}
        >
          {renderNestedText()}
        </SafeLink>
      );
    }
    case 'autoEmail': {
      const email = getRichTextPlainText(text.text);
      return (
        <a
          href={`mailto:${email}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-entity-link"
          dir="auto"
        >
          {renderNestedText()}
        </a>
      );
    }
    case 'autoPhone': {
      const phone = getRichTextPlainText(text.text);
      return (
        <a
          href={`tel:${phone}`}
          className="text-entity-link"
          dir="auto"
        >
          {renderNestedText()}
        </a>
      );
    }
    case 'date':
      return (
        <FormattedDate
          entity={buildDateEntity(text)}
          chatId={chatId}
          messageId={messageId}
        >
          {renderNestedText()}
        </FormattedDate>
      );
    case 'hashtag':
    case 'botCommand':
    case 'cashtag':
    case 'bankCard':
      return renderNestedText();
    case 'math':
      return <Latex source={text.source} />;
    case 'image':
      return (
        <InlineImage
          document={text.document}
          width={text.width}
          height={text.height}
        />
      );
    default:
      return renderUnsupportedText(unsupportedText, text);
  }

  function renderNestedText() {
    return (
      <RichText
        text={getNestedRichText(text)}
        unsupportedText={unsupportedText}
        containerId={containerId}
        pageUrl={pageUrl}
        chatId={chatId}
        messageId={messageId}
        threadId={threadId}
        observeIntersectionForLoading={observeIntersectionForLoading}
        observeIntersectionForPlaying={observeIntersectionForPlaying}
        sharedCanvasRef={sharedCanvasRef}
        sharedCanvasHqRef={sharedCanvasHqRef}
      />
    );
  }

  function renderCustomEmoji(customEmojiText: Extract<ApiRichText, { type: 'customEmoji' }>) {
    if (customEmojiText.document) {
      return (
        <CustomEmoji
          sticker={customEmojiText.document}
          observeIntersectionForLoading={observeIntersectionForLoading}
          observeIntersectionForPlaying={observeIntersectionForPlaying}
          withSharedAnimation={Boolean(sharedCanvasRef)}
          sharedCanvasRef={sharedCanvasRef}
          sharedCanvasHqRef={sharedCanvasHqRef}
          isSelectable
        />
      );
    }

    return (
      <CustomEmoji
        documentId={customEmojiText.documentId}
        observeIntersectionForLoading={observeIntersectionForLoading}
        observeIntersectionForPlaying={observeIntersectionForPlaying}
        withSharedAnimation={Boolean(sharedCanvasRef)}
        sharedCanvasRef={sharedCanvasRef}
        sharedCanvasHqRef={sharedCanvasHqRef}
        isSelectable
      />
    );
  }
};

export function getPageAnchorId(containerId: string, anchor: string) {
  return `${containerId}-${anchor}`;
}

function getLocalPageAnchor(url: string, containerId: string, pageUrl: string | undefined) {
  if (url.startsWith('#')) {
    return buildLocalPageAnchor(containerId, getDecodedHashValue(url.slice(1)));
  }

  if (!pageUrl) {
    return undefined;
  }

  let targetUrl: URL;
  let currentUrl: URL;
  try {
    currentUrl = new URL(pageUrl, window.location.href);
    targetUrl = new URL(url, currentUrl.href);
  } catch {
    return undefined;
  }

  if (
    targetUrl.origin !== currentUrl.origin
    || targetUrl.pathname !== currentUrl.pathname
    || targetUrl.search !== currentUrl.search
  ) {
    return undefined;
  }

  const hash = getDecodedHash(targetUrl);
  return buildLocalPageAnchor(containerId, hash);
}

function resolvePageUrl(url: string, pageUrl: string | undefined) {
  if (!pageUrl) {
    return url;
  }

  try {
    const baseUrl = new URL(pageUrl, window.location.href);
    return new URL(url, baseUrl.href).href;
  } catch {
    return url;
  }
}

function buildLocalPageAnchor(containerId: string, hash: string) {
  if (!hash) {
    return containerId ? {
      href: `#${containerId}`,
      targetId: containerId,
    } : undefined;
  }

  const targetId = getPageAnchorId(containerId, hash);
  return {
    href: `#${targetId}`,
    targetId,
  };
}

function getDecodedHash(url: URL) {
  if (!url.hash) {
    return '';
  }

  return getDecodedHashValue(url.hash.slice(1));
}

function getDecodedHashValue(hash: string) {
  try {
    return decodeURIComponent(hash);
  } catch {
    return hash;
  }
}

function handleLocalAnchorClick(e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) {
  e.preventDefault();

  const targetId = e.currentTarget.dataset.anchorId;
  if (!targetId) {
    return;
  }

  const targetElement = document.getElementById(targetId);
  if (!targetElement) {
    return;
  }

  requestMutation(() => {
    openDetailsAncestors(targetElement);

    requestMeasure(() => {
      targetElement.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  });
}

function openDetailsAncestors(element: HTMLElement) {
  let parent = element.parentElement;

  while (parent) {
    if (parent instanceof HTMLDetailsElement) {
      parent.open = true;
    }

    parent = parent.parentElement;
  }
}

function buildDateEntity(text: Extract<ApiRichText, { type: 'date' }>): ApiMessageEntityFormattedDate {
  const renderedText = getRichTextPlainText(text.text);

  return {
    type: ApiMessageEntityTypes.FormattedDate,
    offset: 0,
    length: renderedText.length,
    date: text.date,
    relative: text.relative ? true : undefined,
    shortTime: text.shortTime ? true : undefined,
    longTime: text.longTime ? true : undefined,
    shortDate: text.shortDate ? true : undefined,
    longDate: text.longDate ? true : undefined,
    dayOfWeek: text.dayOfWeek ? true : undefined,
  };
}

function renderUnsupportedText(unsupportedText: string, text: { type?: string }) {
  return (
    <span className={styles.unsupported}>
      {unsupportedText}
      {DEBUG && text.type && `: ${text.type}`}
    </span>
  );
}

export default RichText;
