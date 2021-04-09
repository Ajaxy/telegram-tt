import { MouseEvent } from 'react';
import React from '../../../lib/teact/teact';
import { getDispatch } from '../../../lib/teact/teactn';

import { ApiMessageEntity, ApiMessageEntityTypes, ApiMessage } from '../../../api/types';

import { getMessageText } from '../../../modules/helpers';
import renderText from './renderText';

import MentionLink from '../../middle/message/MentionLink';
import SafeLink from '../SafeLink';

export type TextPart = string | Element;

export function renderMessageText(message: ApiMessage, highlight?: string, shouldRenderHqEmoji?: boolean) {
  const formattedText = message.content.text;

  if (!formattedText || !formattedText.text) {
    const rawText = getMessageText(message);
    return rawText ? [rawText] : undefined;
  }
  const { text, entities } = formattedText;

  return renderTextWithEntities(text, entities, highlight, shouldRenderHqEmoji);
}

interface IOrganizedEntity {
  entity: ApiMessageEntity;
  organizedIndexes: Set<number>;
  nestedEntities: IOrganizedEntity[];
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
  const nestedEntities = entities
    .filter((e, i) => i > index && e.offset >= offset && e.offset < offset + length)
    .map((e) => organizeEntity(e, entities.indexOf(e), entities, organizedEntityIndexes))
    .filter<IOrganizedEntity>(Boolean as any);

  nestedEntities.forEach((e) => e.organizedIndexes.forEach((i) => organizedIndexes.add(i)));

  return {
    entity,
    organizedIndexes,
    nestedEntities,
  };
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

export function renderTextWithEntities(
  text: string,
  entities?: ApiMessageEntity[],
  highlight?: string,
  shouldRenderHqEmoji?: boolean,
  shouldRenderAsHtml?: boolean,
) {
  if (!entities || !entities.length) {
    return renderMessagePart(text, highlight, shouldRenderHqEmoji, shouldRenderAsHtml);
  }

  const result: TextPart[] = [];
  let deleteLineBreakAfterPre = false;

  const organizedEntites = organizeEntities(entities);

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
          textBefore, highlight, shouldRenderHqEmoji, shouldRenderAsHtml,
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
      : processEntity(entity, entityContent, nestedEntityContent);

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
          textAfter, highlight, shouldRenderHqEmoji, shouldRenderAsHtml,
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

  organizedEntites.forEach((entity, arrayIndex) => {
    const { renderResult, entityEndIndex } = renderEntity(
      index,
      text.length,
      entity,
      arrayIndex === organizedEntites.length - 1,
    );

    result.push(...renderResult);
    index = entityEndIndex;
  });

  return result;
}

function processEntity(
  entity: ApiMessageEntity,
  entityContent: TextPart,
  nestedEntityContent: TextPart[],
) {
  const entityText = typeof entityContent === 'string' && entityContent;
  const renderedContent = nestedEntityContent.length ? nestedEntityContent : entityContent;

  if (!entityText) {
    return renderMessagePart(renderedContent);
  }

  switch (entity.type) {
    case ApiMessageEntityTypes.Bold:
      return <strong>{renderMessagePart(renderedContent)}</strong>;
    case ApiMessageEntityTypes.Blockquote:
      return <blockquote>{renderMessagePart(renderedContent)}</blockquote>;
    case ApiMessageEntityTypes.BotCommand:
      return (
        <a
          onClick={handleBotCommandClick}
          className="text-entity-link"
        >
          {renderMessagePart(renderedContent)}
        </a>
      );
    case ApiMessageEntityTypes.Hashtag:
      return (
        <a
          onClick={handleHashtagClick}
          className="text-entity-link"
        >
          {renderMessagePart(renderedContent)}
        </a>
      );
    case ApiMessageEntityTypes.Cashtag:
      return (
        <a
          onClick={handleHashtagClick}
          className="text-entity-link"
        >
          {renderMessagePart(renderedContent)}
        </a>
      );
    case ApiMessageEntityTypes.Code:
      return <code className="text-entity-code">{renderMessagePart(renderedContent)}</code>;
    case ApiMessageEntityTypes.Email:
      return (
        <a
          href={`mailto:${entityText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-entity-link"
        >
          {renderMessagePart(renderedContent)}
        </a>
      );
    case ApiMessageEntityTypes.Italic:
      return <em>{renderMessagePart(renderedContent)}</em>;
    case ApiMessageEntityTypes.MentionName:
      return (
        <MentionLink userId={entity.userId}>
          {renderMessagePart(renderedContent)}
        </MentionLink>
      );
    case ApiMessageEntityTypes.Mention:
      return (
        <MentionLink username={entityText}>
          {renderMessagePart(renderedContent)}
        </MentionLink>
      );
    case ApiMessageEntityTypes.Phone:
      return (
        <a
          href={`tel:${entityText}`}
          className="text-entity-link"
        >
          {renderMessagePart(renderedContent)}
        </a>
      );
    case ApiMessageEntityTypes.Pre:
      return <pre className="text-entity-pre">{renderMessagePart(renderedContent)}</pre>;
    case ApiMessageEntityTypes.Strike:
      return <del>{renderMessagePart(renderedContent)}</del>;
    case ApiMessageEntityTypes.TextUrl:
    case ApiMessageEntityTypes.Url:
      return (
        <SafeLink
          url={getLinkUrl(entityText, entity)}
          text={entityText}
        >
          {renderMessagePart(renderedContent)}
        </SafeLink>
      );
    case ApiMessageEntityTypes.Underline:
      return <ins>{renderMessagePart(renderedContent)}</ins>;
    default:
      return renderMessagePart(renderedContent);
  }
}

function renderMessagePart(
  content: TextPart | TextPart[],
  highlight?: string,
  shouldRenderHqEmoji?: boolean,
  shouldRenderAsHtml?: boolean,
) {
  if (Array.isArray(content)) {
    const result: TextPart[] = [];

    content.forEach((c) => {
      result.push(...renderMessagePart(c, highlight, shouldRenderHqEmoji, shouldRenderAsHtml));
    });

    return result;
  }

  if (shouldRenderAsHtml) {
    return renderText(content, ['emoji_html', 'br_html']);
  }

  const emojiFilter = shouldRenderHqEmoji ? 'hq_emoji' : 'emoji';

  if (highlight) {
    return renderText(content, [emojiFilter, 'br', 'highlight'], { highlight });
  } else {
    return renderText(content, [emojiFilter, 'br']);
  }
}

function getLinkUrl(entityContent: string, entity: ApiMessageEntity) {
  const { type, url } = entity;
  return type === ApiMessageEntityTypes.TextUrl && url ? url : entityContent;
}

function handleBotCommandClick(e: MouseEvent<HTMLAnchorElement>) {
  getDispatch().sendBotCommand({ command: e.currentTarget.innerText });
}

function handleHashtagClick(e: MouseEvent<HTMLAnchorElement>) {
  getDispatch().setLocalTextSearchQuery({ query: e.currentTarget.innerText });
  getDispatch().searchTextMessagesLocal();
}

function processEntityAsHtml(
  entity: ApiMessageEntity,
  entityContent: TextPart,
  nestedEntityContent: TextPart[],
) {
  const rawEntityText = typeof entityContent === 'string' && entityContent;

  const renderedContent = nestedEntityContent.length
    ? nestedEntityContent.join('')
    : renderText(entityContent, ['emoji_html', 'br_html']).join('');

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
      return `\`\`\`<br/>${renderedContent}<br/>\`\`\``;
    case ApiMessageEntityTypes.Strike:
      return `<del>${renderedContent}</del>`;
    case ApiMessageEntityTypes.MentionName:
      return `<a
        class="text-entity-link"
        data-entity-type="${ApiMessageEntityTypes.MentionName}"
        data-user-id="${entity.userId}"
        contenteditable="false"
      >${renderedContent}</a>`;
    case ApiMessageEntityTypes.Url:
    case ApiMessageEntityTypes.TextUrl:
      return `<a
        class="text-entity-link"
        href=${getLinkUrl(rawEntityText, entity)}
        data-entity-type="${entity.type}"
      >${renderedContent}</a>`;
    default:
      return renderedContent;
  }
}
