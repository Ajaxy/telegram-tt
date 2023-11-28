import React from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiFormattedText, ApiMessageEntity } from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type { TextPart } from '../../../types';
import type { TextFilter } from './renderText';
import { ApiMessageEntityTypes } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import { copyTextToClipboard } from '../../../util/clipboard';
import { translate } from '../../../util/langProvider';
import { buildCustomEmojiHtmlFromEntity } from '../../middle/composer/helpers/customEmoji';
import renderText from './renderText';

import MentionLink from '../../middle/message/MentionLink';
import CodeBlock from '../code/CodeBlock';
import CustomEmoji from '../CustomEmoji';
import SafeLink from '../SafeLink';
import Spoiler from '../spoiler/Spoiler';

interface IOrganizedEntity {
  entity: ApiMessageEntity;
  organizedIndexes: Set<number>;
  nestedEntities: IOrganizedEntity[];
}

const HQ_EMOJI_THRESHOLD = 64;

export function renderTextWithEntities({
  text,
  entities,
  highlight,
  emojiSize,
  shouldRenderAsHtml,
  containerId,
  isSimple,
  isProtected,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  withTranslucentThumbs,
  sharedCanvasRef,
  sharedCanvasHqRef,
  cacheBuster,
  forcePlayback,
}: {
  text: string;
  entities?: ApiMessageEntity[];
  highlight?: string;
  emojiSize?: number;
  shouldRenderAsHtml?: boolean;
  containerId?: string;
  isSimple?: boolean;
  isProtected?: boolean;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  withTranslucentThumbs?: boolean;
  sharedCanvasRef?: React.RefObject<HTMLCanvasElement>;
  sharedCanvasHqRef?: React.RefObject<HTMLCanvasElement>;
  cacheBuster?: string;
  forcePlayback?: boolean;
}) {
  if (!entities?.length) {
    return renderMessagePart(text, highlight, emojiSize, shouldRenderAsHtml, isSimple);
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
        renderResult.push(...renderMessagePart(
          textBefore, highlight, emojiSize, shouldRenderAsHtml, isSimple,
        ) as TextPart[]);
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
        isSimple,
        isProtected,
        observeIntersectionForLoading,
        observeIntersectionForPlaying,
        withTranslucentThumbs,
        emojiSize,
        sharedCanvasRef,
        sharedCanvasHqRef,
        cacheBuster,
        forcePlayback,
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
        renderResult.push(...renderMessagePart(
          textAfter, highlight, emojiSize, shouldRenderAsHtml, isSimple,
        ) as TextPart[]);
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
  });

  if (Array.isArray(result)) {
    return result.join('');
  }

  return result;
}

function renderMessagePart(
  content: TextPart | TextPart[],
  highlight?: string,
  emojiSize?: number,
  shouldRenderAsHtml?: boolean,
  isSimple?: boolean,
) {
  if (Array.isArray(content)) {
    const result: TextPart[] = [];

    content.forEach((c) => {
      result.push(...renderMessagePart(c, highlight, emojiSize, shouldRenderAsHtml, isSimple));
    });

    return result;
  }

  if (shouldRenderAsHtml) {
    return renderText(content, ['escape_html', 'emoji_html', 'br_html']);
  }

  const emojiFilter = emojiSize && emojiSize > HQ_EMOJI_THRESHOLD ? 'hq_emoji' : 'emoji';

  const filters: TextFilter[] = [emojiFilter];
  if (!isSimple) {
    filters.push('br');
  }

  if (highlight) {
    return renderText(content, filters.concat('highlight'), { highlight });
  } else {
    return renderText(content, filters);
  }
}

// Organize entities in a tree-like structure to better represent how the text will be displayed
function organizeEntities(entities: ApiMessageEntity[]) {
  const organizedEntityIndexes: Set<number> = new Set();
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
  isSimple,
  isProtected,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  withTranslucentThumbs,
  emojiSize,
  sharedCanvasRef,
  sharedCanvasHqRef,
  cacheBuster,
  forcePlayback,
} : {
  entity: ApiMessageEntity;
  entityContent: TextPart;
  nestedEntityContent: TextPart[];
  highlight?: string;
  containerId?: string;
  isSimple?: boolean;
  isProtected?: boolean;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  withTranslucentThumbs?: boolean;
  emojiSize?: number;
  sharedCanvasRef?: React.RefObject<HTMLCanvasElement>;
  sharedCanvasHqRef?: React.RefObject<HTMLCanvasElement>;
  cacheBuster?: string;
  forcePlayback?: boolean;
}) {
  const entityText = typeof entityContent === 'string' && entityContent;
  const renderedContent = nestedEntityContent.length ? nestedEntityContent : entityContent;

  function renderNestedMessagePart() {
    return renderMessagePart(
      renderedContent, highlight, undefined, undefined, isSimple,
    );
  }

  if (!entityText) {
    return renderNestedMessagePart();
  }

  if (isSimple) {
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
          withSharedAnimation
          sharedCanvasRef={sharedCanvasRef}
          sharedCanvasHqRef={sharedCanvasHqRef}
          withGridFix={!emojiSize}
          observeIntersectionForLoading={observeIntersectionForLoading}
          observeIntersectionForPlaying={observeIntersectionForPlaying}
          withTranslucentThumb={withTranslucentThumbs}
          forceAlways={forcePlayback}
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
        <div className="text-entity-blockquote-wrapper">
          <blockquote data-entity-type={entity.type}>
            {renderNestedMessagePart()}
          </blockquote>
        </div>
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
    case ApiMessageEntityTypes.Hashtag:
      return (
        <a
          onClick={handleHashtagClick}
          className="text-entity-link"
          dir="auto"
          data-entity-type={entity.type}
        >
          {renderNestedMessagePart()}
        </a>
      );
    case ApiMessageEntityTypes.Cashtag:
      return (
        <a
          onClick={handleHashtagClick}
          className="text-entity-link"
          dir="auto"
          data-entity-type={entity.type}
        >
          {renderNestedMessagePart()}
        </a>
      );
    case ApiMessageEntityTypes.Code:
      return (
        <code
          className={buildClassName('text-entity-code', !isProtected && 'clickable')}
          onClick={!isProtected ? handleCodeClick : undefined}
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
          href={entityText}
          onClick={handleEmailClick}
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
        >
          {renderNestedMessagePart()}
        </SafeLink>
      );
    case ApiMessageEntityTypes.Underline:
      return <ins data-entity-type={entity.type}>{renderNestedMessagePart()}</ins>;
    case ApiMessageEntityTypes.Spoiler:
      return <Spoiler containerId={containerId}>{renderNestedMessagePart()}</Spoiler>;
    case ApiMessageEntityTypes.CustomEmoji:
      return (
        <CustomEmoji
          key={cacheBuster ? `${cacheBuster}-${entity.offset}` : undefined}
          documentId={entity.documentId}
          size={emojiSize}
          withSharedAnimation
          sharedCanvasRef={sharedCanvasRef}
          sharedCanvasHqRef={sharedCanvasHqRef}
          withGridFix={!emojiSize}
          observeIntersectionForLoading={observeIntersectionForLoading}
          observeIntersectionForPlaying={observeIntersectionForPlaying}
          withTranslucentThumb={withTranslucentThumbs}
          forceAlways={forcePlayback}
        />
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
    ? nestedEntityContent.join('')
    : renderText(content, ['escape_html', 'emoji_html', 'br_html']).join('');

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
      return `\`\`\`${renderText(entity.language || '', ['escape_html'])}<br/>${renderedContent}<br/>\`\`\`<br/>`;
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
      return `<span
        class="blockquote"
        data-entity-type="${ApiMessageEntityTypes.Blockquote}"
        >${renderedContent}</span>`;
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

function handleHashtagClick(e: React.MouseEvent<HTMLAnchorElement>) {
  getActions().setLocalTextSearchQuery({ query: e.currentTarget.innerText });
  getActions().searchTextMessagesLocal();
}

function handleCodeClick(e: React.MouseEvent<HTMLElement>) {
  copyTextToClipboard(e.currentTarget.innerText);
  getActions().showNotification({
    message: translate('TextCopied'),
  });
}
function handleEmailClick(e: React.MouseEvent<HTMLAnchorElement>) {
  e.preventDefault(); // Предотвращаем переход по ссылке
  const url = e.currentTarget.getAttribute('href');
  if (url) {
    copyTextToClipboard(url);
    getActions().showNotification({
      message: translate('EmailCopied'),
    });
  }
}
