import React from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { TextPart } from '../../../types';
import type { ApiFormattedText, ApiMessageEntity } from '../../../api/types';
import { ApiMessageEntityTypes } from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type { TextFilter } from './renderText';

import buildClassName from '../../../util/buildClassName';
import renderText from './renderText';
import { copyTextToClipboard } from '../../../util/clipboard';
import { getTranslation } from '../../../util/langProvider';
import { buildCustomEmojiHtmlFromEntity } from '../../middle/composer/helpers/customEmoji';

import MentionLink from '../../middle/message/MentionLink';
import SafeLink from '../SafeLink';
import Spoiler from '../spoiler/Spoiler';
import CustomEmoji from '../CustomEmoji';
import CodeBlock from '../code/CodeBlock';

interface IOrganizedEntity {
  entity: ApiMessageEntity;
  organizedIndexes: Set<number>;
  nestedEntities: IOrganizedEntity[];
}

export function renderTextWithEntities(
  text: string,
  entities?: ApiMessageEntity[],
  highlight?: string,
  shouldRenderHqEmoji?: boolean,
  shouldRenderAsHtml?: boolean,
  messageId?: number,
  isSimple?: boolean,
  isProtected?: boolean,
  observeIntersection?: ObserveFn,
) {
  if (!entities || !entities.length) {
    return renderMessagePart(text, highlight, shouldRenderHqEmoji, shouldRenderAsHtml, isSimple);
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
          textBefore, highlight, shouldRenderHqEmoji, shouldRenderAsHtml, isSimple,
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
      : processEntity(
        entity, entityContent, nestedEntityContent, highlight, messageId, isSimple, isProtected, observeIntersection,
      );

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
          textAfter, highlight, shouldRenderHqEmoji, shouldRenderAsHtml, isSimple,
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

  const result = renderTextWithEntities(
    text,
    entities,
    undefined,
    undefined,
    true,
  );

  if (Array.isArray(result)) {
    return result.join('');
  }

  return result;
}

function renderMessagePart(
  content: TextPart | TextPart[],
  highlight?: string,
  shouldRenderHqEmoji?: boolean,
  shouldRenderAsHtml?: boolean,
  isSimple?: boolean,
) {
  if (Array.isArray(content)) {
    const result: TextPart[] = [];

    content.forEach((c) => {
      result.push(...renderMessagePart(c, highlight, shouldRenderHqEmoji, shouldRenderAsHtml, isSimple));
    });

    return result;
  }

  if (shouldRenderAsHtml) {
    return renderText(content, ['escape_html', 'emoji_html', 'br_html']);
  }

  const emojiFilter = shouldRenderHqEmoji ? 'hq_emoji' : 'emoji';

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

function processEntity(
  entity: ApiMessageEntity,
  entityContent: TextPart,
  nestedEntityContent: TextPart[],
  highlight?: string,
  messageId?: number,
  isSimple?: boolean,
  isProtected?: boolean,
  observeIntersection?: ObserveFn,
) {
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
        <CustomEmoji documentId={entity.documentId} observeIntersection={observeIntersection} withGridFix>
          {renderNestedMessagePart()}
        </CustomEmoji>
      );
    }
    return text;
  }

  switch (entity.type) {
    case ApiMessageEntityTypes.Bold:
      return <strong>{renderNestedMessagePart()}</strong>;
    case ApiMessageEntityTypes.Blockquote:
      return <blockquote>{renderNestedMessagePart()}</blockquote>;
    case ApiMessageEntityTypes.BotCommand:
      return (
        <a
          onClick={handleBotCommandClick}
          className="text-entity-link"
          dir="auto"
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
        >
          {renderNestedMessagePart()}
        </a>
      );
    case ApiMessageEntityTypes.Italic:
      return <em>{renderNestedMessagePart()}</em>;
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
        >
          {renderNestedMessagePart()}
        </a>
      );
    case ApiMessageEntityTypes.Pre:
      return <CodeBlock text={entityText} language={entity.language} noCopy={isProtected} />;
    case ApiMessageEntityTypes.Strike:
      return <del>{renderNestedMessagePart()}</del>;
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
      return <ins>{renderNestedMessagePart()}</ins>;
    case ApiMessageEntityTypes.Spoiler:
      return <Spoiler messageId={messageId}>{renderNestedMessagePart()}</Spoiler>;
    case ApiMessageEntityTypes.CustomEmoji:
      return (
        <CustomEmoji documentId={entity.documentId} observeIntersection={observeIntersection} withGridFix>
          {renderNestedMessagePart()}
        </CustomEmoji>
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
      return `\`\`\`${entity.language || ''}<br/>${renderedContent}<br/>\`\`\`<br/>`;
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
    message: getTranslation('TextCopied'),
  });
}
