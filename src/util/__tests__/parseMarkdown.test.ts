import { ApiMessageEntityTypes } from '../../api/types';

import { parseMarkdown } from '../parseMarkdown';

jest.mock('../windowEnvironment', () => ({
  IS_EMOJI_SUPPORTED: false,
}));

describe('parseMarkdown', () => {
  test('should strip redundant nbsp', () => {
    const input = 'Hello&nbsp;World';
    const expected = 'Hello World';
    expect(parseMarkdown(input)).toBe(expected);
  });

  test('should replace <div><br></div> with newline', () => {
    const input = '<div><br></div>';
    const expected = '\n';
    expect(parseMarkdown(input)).toBe(expected);
  });

  test('should replace <br> with newline', () => {
    const input = 'Hello<br>World';
    const expected = 'Hello\nWorld';
    expect(parseMarkdown(input)).toBe(expected);
  });

  test('should strip redundant <div> tags', () => {
    const input = '<div>Hello</div><div>World</div>';
    const expected = '\nHello\nWorld';
    expect(parseMarkdown(input)).toBe(expected);
  });

  test('should handle code blocks with language', () => {
    const input = '```js\nconsole.log("Hello");\n```';
    const expected = '<pre data-language="js">console.log("Hello");\n</pre>';
    expect(parseMarkdown(input)).toBe(expected);
  });

  test('should handle inline code', () => {
    const input = 'This is `inline code`';
    const expected = 'This is <code>inline code</code>';
    expect(parseMarkdown(input)).toBe(expected);
  });

  test('should handle bold text', () => {
    const input = 'This is **bold** text';
    const expected = 'This is <b>bold</b> text';
    expect(parseMarkdown(input)).toBe(expected);
  });

  test('should handle italic text', () => {
    const input = 'This is __italic__ text';
    const expected = 'This is <i>italic</i> text';
    expect(parseMarkdown(input)).toBe(expected);
  });

  test('should handle strikethrough text', () => {
    const input = 'This is ~~strikethrough~~ text';
    const expected = 'This is <s>strikethrough</s> text';
    expect(parseMarkdown(input)).toBe(expected);
  });

  test('should handle spoiler text', () => {
    const input = 'This is ||spoiler|| text';
    const expected = `This is <span data-entity-type="${ApiMessageEntityTypes.Spoiler}">spoiler</span> text`;
    expect(parseMarkdown(input)).toBe(expected);
  });

  test('should handle custom emoji when emoji is not supported', () => {
    const input = '[😊](customEmoji:123)';
    const expected = '<img alt="😊" data-document-id="123">';
    expect(parseMarkdown(input)).toBe(expected);
  });

  test('should handle mixed content', () => {
    const input = `
<div>Hello</div>
**bold**
__italic__
~~strikethrough~~
||spoiler||
[😊](customEmoji:123)
<br>
\`inline code\`
\`\`\`js
console.log("Hello");
\`\`\`
`;
    const expected = `
\nHello
<b>bold</b>
<i>italic</i>
<s>strikethrough</s>
<span data-entity-type="${ApiMessageEntityTypes.Spoiler}">spoiler</span>
<img alt="😊" data-document-id="123">
\n
<code>inline code</code>
<pre data-language="js">console.log("Hello");\n</pre>
`;
    expect(parseMarkdown(input)).toBe(expected);
  });
});

describe('parseMarkdown with emoji support', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('../windowEnvironment', () => ({
      IS_EMOJI_SUPPORTED: true,
    }));
  });

  test('should handle custom emoji when emoji is supported', () => {
    const input = '[😊](customEmoji:123)';
    const expected = '<img alt="😊" data-document-id="123">';
    expect(parseMarkdown(input)).toBe(expected);
  });
});
