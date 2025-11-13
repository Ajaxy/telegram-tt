import type { ElementRef } from '../../../lib/teact/teact';
import type React from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiFormattedText, ApiMessageEntity } from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type { TextPart, ThreadId } from '../../../types';
import type { TextFilter } from './renderText';
import { ApiMessageEntityTypes } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import { copyTextToClipboard } from '../../../util/clipboard';
import { oldTranslate } from '../../../util/oldLangProvider';
import { buildCustomEmojiHtmlFromEntity } from '../../middle/composer/helpers/customEmoji';
import renderText from './renderText';

import MentionLink from '../../middle/message/MentionLink';
import Blockquote from '../Blockquote';
import CodeBlock from '../code/CodeBlock';
import CustomEmoji from '../CustomEmoji';
import SafeLink from '../SafeLink';
import Spoiler from '../spoiler/Spoiler';

interface IOrganizedEntity {
  entity: ApiMessageEntity;
  organizedIndexes: Set<number>;
  nestedEntities: IOrganizedEntity[];
}
type RenderTextParams = Parameters<typeof renderText>[2];

const HQ_EMOJI_THRESHOLD = 64;

export function renderTextWithEntities({
  text,
  entities,
  highlight,
  emojiSize,
  shouldRenderAsHtml,
  containerId,
  asPreview,
  isProtected,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  withTranslucentThumbs,
  sharedCanvasRef,
  sharedCanvasHqRef,
  cacheBuster,
  forcePlayback,
  noCustomEmojiPlayback,
  isInSelectMode,
  chatId,
  messageId,
  threadId,
  maxTimestamp,
}: {
  text: string;
  entities?: ApiMessageEntity[];
  highlight?: string;
  emojiSize?: number;
  shouldRenderAsHtml?: boolean;
  containerId?: string;
  asPreview?: boolean;
  isProtected?: boolean;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  withTranslucentThumbs?: boolean;
  sharedCanvasRef?: ElementRef<HTMLCanvasElement>;
  sharedCanvasHqRef?: ElementRef<HTMLCanvasElement>;
  cacheBuster?: string;
  forcePlayback?: boolean;
  noCustomEmojiPlayback?: boolean;
  isInSelectMode?: boolean;
  chatId?: string;
  messageId?: number;
  threadId?: ThreadId;
  maxTimestamp?: number;
}) {
  if (!entities?.length) {
    return renderMessagePart({
      content: text,
      highlight,
      emojiSize,
      shouldRenderAsHtml,
      asPreview,
    });
  }

  const result: TextPart[] = [];
  let deleteLineBreakAfterPre = false;

  const organizedEntities = organizeEntities(entities);

  // Recursive function to render regular and nested entities
  function renderEntity(
    textPartStart: number,
    textPartEnd: number,
    organizedEntity: IOrganizedEntity,
    isLastEntity: boolean,
  ) {
    const renderResult: TextPart[] = [];
    const { entity, nestedEntities } = organizedEntity;
    const { offset, length, type } = entity;

    // Render text before the entity
    let textBefore = text.substring(textPartStart, offset);
    const textBeforeLength = textBefore.length;
    if (textBefore) {
      if (deleteLineBreakAfterPre && textBefore.length > 0 && textBefore[0] === '\n') {
        textBefore = textBefore.substr(1);
        deleteLineBreakAfterPre = false;
      }
      if (textBefore) {
        renderResult.push(...renderMessagePart({
          content: textBefore,
          highlight,
          emojiSize,
          shouldRenderAsHtml,
          asPreview,
        }));
      }
    }

    const entityStartIndex = textPartStart + textBeforeLength;
    const entityEndIndex = entityStartIndex + length;

    let entityContent: TextPart = text.substring(offset, offset + length);
    const nestedEntityContent: TextPart[] = [];

    if (deleteLineBreakAfterPre && entityContent.length > 0 && entityContent[0] === '\n') {
      entityContent = entityContent.substr(1);
      deleteLineBreakAfterPre = false;
    }

    if (type === ApiMessageEntityTypes.Pre) {
      deleteLineBreakAfterPre = true;
    }

    // Render nested entities, if any
    if (nestedEntities.length) {
      let nestedIndex = entityStartIndex;

      nestedEntities.forEach((nestedEntity, nestedEntityIndex) => {
        const {
          renderResult: nestedResult,
          entityEndIndex: nestedEntityEndIndex,
        } = renderEntity(
          nestedIndex,
          entityEndIndex,
          nestedEntity,
          nestedEntityIndex === nestedEntities.length - 1,
        );

        nestedEntityContent.push(...nestedResult);
        nestedIndex = nestedEntityEndIndex;
      });
    }

    // Render the entity itself
    const newEntity = shouldRenderAsHtml
      ? processEntityAsHtml(entity, entityContent, nestedEntityContent)
      : processEntity({
        entity,
        entityContent,
        nestedEntityContent,
        highlight,
        containerId,
        asPreview,
        isProtected,
        observeIntersectionForLoading,
        observeIntersectionForPlaying,
        withTranslucentThumbs,
        emojiSize,
        sharedCanvasRef,
        sharedCanvasHqRef,
        cacheBuster,
        forcePlayback,
        noCustomEmojiPlayback,
        isInSelectMode,
        chatId,
        messageId,
        threadId,
        maxTimestamp,
      });

    if (Array.isArray(newEntity)) {
      renderResult.push(...newEntity);
    } else {
      renderResult.push(newEntity);
    }

    // Render text after the entity, if it is the last entity in the text,
    // or the last nested entity inside of another entity
    if (isLastEntity && entityEndIndex < textPartEnd) {
      let textAfter = text.substring(entityEndIndex, textPartEnd);
      if (deleteLineBreakAfterPre && textAfter.length > 0 && textAfter[0] === '\n') {
        textAfter = textAfter.substring(1);
      }
      if (textAfter) {
        renderResult.push(...renderMessagePart({
          content: textAfter,
          highlight,
          emojiSize,
          shouldRenderAsHtml,
          asPreview,
        }));
      }
    }

    return {
      renderResult,
      entityEndIndex,
    };
  }

  // Process highest-level entities
  let index = 0;

  organizedEntities.forEach((entity, arrayIndex) => {
    const { renderResult, entityEndIndex } = renderEntity(
      index,
      text.length,
      entity,
      arrayIndex === organizedEntities.length - 1,
    );

    result.push(...renderResult);
    index = entityEndIndex;
  });

  return result;
}

export function getTextWithEntitiesAsHtml(formattedText?: ApiFormattedText) {
  const { text, entities } = formattedText || {};
  if (!text) {
    return '';
  }

  const result = renderTextWithEntities({
    text,
    entities,
    shouldRenderAsHtml: true,
  }) as string[];

  if (Array.isArray(result)) {
    return result.join('');
  }

  return result;
}

function renderMessagePart({
  content,
  highlight,
  focusedQuote,
  emojiSize,
  shouldRenderAsHtml,
  asPreview,
}: {
  content: TextPart | TextPart[];
  highlight?: string;
  focusedQuote?: string;
  emojiSize?: number;
  shouldRenderAsHtml?: boolean;
  asPreview?: boolean;
}) {
  if (Array.isArray(content)) {
    const result: TextPart[] = [];

    content.forEach((c) => {
      result.push(...renderMessagePart({
        content: c,
        highlight,
        focusedQuote,
        emojiSize,
        shouldRenderAsHtml,
        asPreview,
      }));
    });

    return result;
  }

  if (shouldRenderAsHtml) {
    return renderText(content, ['escape_html', 'emoji_html', 'br_html']);
  }

  const emojiFilter = emojiSize && emojiSize > HQ_EMOJI_THRESHOLD ? 'hq_emoji' : 'emoji';

  const filters: TextFilter[] = [emojiFilter];
  const params: RenderTextParams = {};
  if (!asPreview) {
    filters.push('br');
  }

  if (highlight) {
    filters.push('highlight');
    params.highlight = highlight;
  }

  return renderText(content, filters, params);
}

export function insertTextEntity(entities: ApiMessageEntity[], newEntity: ApiMessageEntity) {
  const resultEntities: ApiMessageEntity[] = [];

  const newEntityStart = newEntity.offset;
  const newEntityEnd = newEntity.offset + newEntity.length;

  for (const existingEntity of entities) {
    const existingEntityStart = existingEntity.offset;
    const existingEntityEnd = existingEntity.offset + existingEntity.length;
    // Push as is if edges do not overlap
    if (existingEntityEnd <= newEntityStart
      || existingEntityStart > newEntityEnd
      || (existingEntityStart > newEntityStart
        && existingEntityEnd < newEntityEnd)
      || (existingEntityStart === newEntityStart && existingEntityEnd === newEntityEnd)) {
      resultEntities.push(existingEntity);
      continue;
    }

    // If start edge overlaps
    if (existingEntityStart < newEntityStart && existingEntityEnd > newEntityStart) {
      // Split entity in two
      resultEntities.push({
        ...existingEntity,
        length: newEntityStart - existingEntityStart,
      });
      resultEntities.push({
        ...existingEntity,
        offset: newEntityStart,
        length: existingEntityEnd - newEntityStart,
      });
    }

    // If end edge overlaps
    if (existingEntityStart < newEntityEnd
      && existingEntityEnd > newEntityEnd) {
      // Split entity in two
      resultEntities.push({
        ...existingEntity,
        offset: newEntityEnd,
        length: existingEntityEnd - newEntityStart - newEntity.length,
      });
      resultEntities.push({
        ...existingEntity,
        length: newEntityEnd - existingEntityStart,
      });
    }
  }

  resultEntities.push(newEntity);
  // Sort entities by offset, longer entities first
  return resultEntities.sort((a, b) => a.offset - b.offset || b.length - a.length);
}

// Organize entities in a tree-like structure to better represent how the text will be displayed
function organizeEntities(entities: ApiMessageEntity[]) {
  const organizedEntityIndexes = new Set<number>();
  const organizedEntities: IOrganizedEntity[] = [];

  entities.forEach((entity, index) => {
    if (organizedEntityIndexes.has(index)) {
      return;
    }

    const organizedEntity = organizeEntity(entity, index, entities, organizedEntityIndexes);
    if (organizedEntity) {
      organizedEntity.organizedIndexes.forEach((organizedIndex) => {
        organizedEntityIndexes.add(organizedIndex);
      });

      organizedEntities.push(organizedEntity);
    }
  });

  return organizedEntities;
}

function organizeEntity(
  entity: ApiMessageEntity,
  index: number,
  entities: ApiMessageEntity[],
  organizedEntityIndexes: Set<number>,
): IOrganizedEntity | undefined {
  const { offset, length } = entity;
  const organizedIndexes = new Set([index]);

  if (organizedEntityIndexes.has(index)) {
    return undefined;
  }

  // Determine any nested entities inside current entity
  const nestedEntities: IOrganizedEntity[] = [];
  const parsedNestedEntities = entities
    .filter((e, i) => i > index && e.offset >= offset && e.offset < offset + length)
    .map((e) => organizeEntity(e, entities.indexOf(e), entities, organizedEntityIndexes))
    .filter(Boolean);

  parsedNestedEntities.forEach((parsedEntity) => {
    let isChanged = false;

    parsedEntity.organizedIndexes.forEach((organizedIndex) => {
      if (!isChanged && !organizedIndexes.has(organizedIndex)) {
        isChanged = true;
      }

      organizedIndexes.add(organizedIndex);
    });

    if (isChanged) {
      nestedEntities.push(parsedEntity);
    }
  });

  return {
    entity,
    organizedIndexes,
    nestedEntities,
  };
}

function processEntity({
  entity,
  entityContent,
  nestedEntityContent,
  highlight,
  containerId,
  asPreview,
  isProtected,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  withTranslucentThumbs,
  emojiSize,
  sharedCanvasRef,
  sharedCanvasHqRef,
  cacheBuster,
  forcePlayback,
  noCustomEmojiPlayback,
  isInSelectMode,
  chatId,
  messageId,
  threadId,
  maxTimestamp,
}: {
  entity: ApiMessageEntity;
  entityContent: TextPart;
  nestedEntityContent: TextPart[];
  highlight?: string;
  focusedQuote?: string;
  containerId?: string;
  asPreview?: boolean;
  isProtected?: boolean;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  withTranslucentThumbs?: boolean;
  emojiSize?: number;
  sharedCanvasRef?: ElementRef<HTMLCanvasElement>;
  sharedCanvasHqRef?: ElementRef<HTMLCanvasElement>;
  cacheBuster?: string;
  forcePlayback?: boolean;
  noCustomEmojiPlayback?: boolean;
  isInSelectMode?: boolean;
  chatId?: string;
  messageId?: number;
  threadId?: ThreadId;
  maxTimestamp?: number;
}) {
  const entityText = typeof entityContent === 'string' && entityContent;
  const renderedContent = nestedEntityContent.length ? nestedEntityContent : entityContent;

  function renderNestedMessagePart() {
    return renderMessagePart({
      content: renderedContent,
      highlight,
      emojiSize,
      asPreview,
    });
  }

  if (!entityText) {
    return renderNestedMessagePart();
  }

  if (asPreview) {
    const text = renderNestedMessagePart();
    if (entity.type === ApiMessageEntityTypes.Spoiler) {
      return <Spoiler>{text}</Spoiler>;
    }

    if (entity.type === ApiMessageEntityTypes.CustomEmoji) {
      return (
        <CustomEmoji
          key={cacheBuster ? `${cacheBuster}-${entity.offset}` : undefined}
          documentId={entity.documentId}
          size={emojiSize}
          isSelectable
          withSharedAnimation
          sharedCanvasRef={sharedCanvasRef}
          sharedCanvasHqRef={sharedCanvasHqRef}
          observeIntersectionForLoading={observeIntersectionForLoading}
          observeIntersectionForPlaying={observeIntersectionForPlaying}
          withTranslucentThumb={withTranslucentThumbs}
          forceAlways={forcePlayback}
          noPlay={noCustomEmojiPlayback}
        />
      );
    }
    return text;
  }

  switch (entity.type) {
    case ApiMessageEntityTypes.Bold:
      return <strong data-entity-type={entity.type}>{renderNestedMessagePart()}</strong>;
    case ApiMessageEntityTypes.Blockquote:
      return (
        <Blockquote canBeCollapsible={entity.canCollapse} isToggleDisabled={isInSelectMode}>
          {renderNestedMessagePart()}
        </Blockquote>
      );
    case ApiMessageEntityTypes.BotCommand:
      return (
        <a
          onClick={handleBotCommandClick}
          className="text-entity-link"
          dir="auto"
          data-entity-type={entity.type}
        >
          {renderNestedMessagePart()}
        </a>
      );
    case ApiMessageEntityTypes.Hashtag: {
      const [tag, username] = entityContent.split('@');
      return (
        <a
          onClick={() => handleHashtagClick(tag, username)}
          className="text-entity-link"
          dir="auto"
          data-entity-type={entity.type}
        >
          {renderNestedMessagePart()}
        </a>
      );
    }
    case ApiMessageEntityTypes.Cashtag: {
      const [tag, username] = entityContent.split('@');
      return (
        <a
          onClick={() => handleHashtagClick(tag, username)}
          className="text-entity-link"
          dir="auto"
          data-entity-type={entity.type}
        >
          {renderNestedMessagePart()}
        </a>
      );
    }
    case ApiMessageEntityTypes.Code:
      return (
        <code
          className={buildClassName('text-entity-code', 'clickable')}
          onClick={handleCodeClick}
          role="textbox"
          tabIndex={0}
          data-entity-type={entity.type}
        >
          {renderNestedMessagePart()}
        </code>
      );
    case ApiMessageEntityTypes.Email:
      return (
        <a
          href={`mailto:${entityText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-entity-link"
          dir="auto"
          data-entity-type={entity.type}
        >
          {renderNestedMessagePart()}
        </a>
      );
    case ApiMessageEntityTypes.Italic:
      return <em data-entity-type={entity.type}>{renderNestedMessagePart()}</em>;
    case ApiMessageEntityTypes.MentionName:
      return (
        <MentionLink userId={entity.userId}>
          {renderNestedMessagePart()}
        </MentionLink>
      );
    case ApiMessageEntityTypes.Mention:
      return (
        <MentionLink username={entityText}>
          {renderNestedMessagePart()}
        </MentionLink>
      );
    case ApiMessageEntityTypes.Phone:
      return (
        <a
          href={`tel:${entityText}`}
          className="text-entity-link"
          dir="auto"
          data-entity-type={entity.type}
        >
          {renderNestedMessagePart()}
        </a>
      );
    case ApiMessageEntityTypes.Pre:
      return <CodeBlock text={entityText} language={entity.language} noCopy={isProtected} />;
    case ApiMessageEntityTypes.Strike:
      return <del data-entity-type={entity.type}>{renderNestedMessagePart()}</del>;
    case ApiMessageEntityTypes.TextUrl:
    case ApiMessageEntityTypes.Url:
      return (
        <SafeLink
          url={getLinkUrl(entityText, entity)}
          text={entityText}
          chatId={chatId}
          messageId={messageId}
          threadId={threadId}
          entityType={entity.type}
        >
          {renderNestedMessagePart()}
        </SafeLink>
      );
    case ApiMessageEntityTypes.Underline:
      return <ins data-entity-type={entity.type}>{renderNestedMessagePart()}</ins>;
    case ApiMessageEntityTypes.Timestamp:
      if (!chatId || !messageId || !maxTimestamp || entity.timestamp > maxTimestamp) {
        return renderNestedMessagePart();
      }

      return (
        <a
          onClick={() => handleTimecodeClick(chatId, messageId, threadId, entity.timestamp)}
          className="text-entity-link"
          dir="auto"
          data-entity-type={entity.type}
        >
          {renderNestedMessagePart()}
        </a>
      );
    case ApiMessageEntityTypes.Spoiler:
      return <Spoiler containerId={containerId}>{renderNestedMessagePart()}</Spoiler>;
    case ApiMessageEntityTypes.CustomEmoji:
      return (
        <CustomEmoji
          key={cacheBuster ? `${cacheBuster}-${entity.offset}` : undefined}
          documentId={entity.documentId}
          size={emojiSize}
          isSelectable
          withSharedAnimation
          sharedCanvasRef={sharedCanvasRef}
          sharedCanvasHqRef={sharedCanvasHqRef}
          observeIntersectionForLoading={observeIntersectionForLoading}
          observeIntersectionForPlaying={observeIntersectionForPlaying}
          withTranslucentThumb={withTranslucentThumbs}
          forceAlways={forcePlayback}
          noPlay={noCustomEmojiPlayback}
        />
      );
    case ApiMessageEntityTypes.QuoteFocus:
      return (
        <span className="matching-text-highlight is-quote">{renderNestedMessagePart()}</span>
      );
    default:
      return renderNestedMessagePart();
  }
}

function processEntityAsHtml(
  entity: ApiMessageEntity,
  entityContent: TextPart,
  nestedEntityContent: TextPart[],
) {
  const rawEntityText = typeof entityContent === 'string' ? entityContent : undefined;

  // Prevent adding newlines when editing
  const content = entity.type === ApiMessageEntityTypes.Pre ? (entityContent as string).trimEnd() : entityContent;

  const renderedContent = nestedEntityContent.length
    ? (nestedEntityContent as string[]).join('')
    : (renderText(content, ['escape_html', 'emoji_html', 'br_html']) as string[]).join('');

  if (!rawEntityText) {
    return renderedContent;
  }

  switch (entity.type) {
    case ApiMessageEntityTypes.Bold:
      return `<b>${renderedContent}</b>`;
    case ApiMessageEntityTypes.Italic:
      return `<i>${renderedContent}</i>`;
    case ApiMessageEntityTypes.Underline:
      return `<u>${renderedContent}</u>`;
    case ApiMessageEntityTypes.Code:
      return `<code class="text-entity-code">${renderedContent}</code>`;
    case ApiMessageEntityTypes.Pre:
      // eslint-disable-next-line @stylistic/max-len
      return `\`\`\`${renderText(entity.language || '', ['escape_html'])[0] as string}<br/>${renderedContent}<br/>\`\`\`<br/>`;
    case ApiMessageEntityTypes.Strike:
      return `<del>${renderedContent}</del>`;
    case ApiMessageEntityTypes.MentionName:
      return `<a
        class="text-entity-link"
        data-entity-type="${ApiMessageEntityTypes.MentionName}"
        data-user-id="${entity.userId}"
        contenteditable="false"
        dir="auto"
      >${renderedContent}</a>`;
    case ApiMessageEntityTypes.Url:
    case ApiMessageEntityTypes.TextUrl:
      return `<a
        class="text-entity-link"
        href=${getLinkUrl(rawEntityText, entity)}
        data-entity-type="${entity.type}"
        dir="auto"
      >${renderedContent}</a>`;
    case ApiMessageEntityTypes.Spoiler:
      return `<span
        class="spoiler"
        data-entity-type="${ApiMessageEntityTypes.Spoiler}"
        >${renderedContent}</span>`;
    case ApiMessageEntityTypes.CustomEmoji:
      return buildCustomEmojiHtmlFromEntity(rawEntityText, entity);
    case ApiMessageEntityTypes.Blockquote:
      return `<blockquote
        class="blockquote"
        data-entity-type="${ApiMessageEntityTypes.Blockquote}"
        >${renderedContent}</blockquote>`;
    default:
      return renderedContent;
  }
}

function getLinkUrl(entityContent: string, entity: ApiMessageEntity) {
  const { type } = entity;
  return type === ApiMessageEntityTypes.TextUrl && entity.url ? entity.url : entityContent;
}

function handleBotCommandClick(e: React.MouseEvent<HTMLAnchorElement>) {
  getActions().sendBotCommand({ command: e.currentTarget.innerText });
}

function handleHashtagClick(hashtag?: string, username?: string) {
  if (!hashtag) return;
  if (username) {
    getActions().openChatByUsername({
      username,
      onChatChanged: {
        action: 'searchHashtag',
        payload: { hashtag },
      },
    });
    return;
  }
  getActions().searchHashtag({ hashtag });
}

function handleCodeClick(e: React.MouseEvent<HTMLElement>) {
  copyTextToClipboard(e.currentTarget.innerText);
  getActions().showNotification({
    message: oldTranslate('TextCopied'),
  });
}

function handleTimecodeClick(
  chatId: string, messageId: number, threadId: ThreadId | undefined, timestamp: number,
) {
  getActions().openMediaFromTimestamp({
    chatId, messageId, threadId, timestamp,
  });
}
