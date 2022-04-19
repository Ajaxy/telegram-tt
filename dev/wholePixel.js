const stylelint = require('stylelint');
// eslint-disable-next-line import/no-unresolved -- TS BUG
const postcss = require('postcss');

const ruleName = 'plugin/whole-pixel';

const isString = (s) => typeof s === 'string';

const messages = stylelint.utils.ruleMessages(ruleName, {
  expected: (unfixed, fixed) => `Expected "${unfixed}" to be "${fixed}"`,
});

const PX_PER_REM = 16;
const unitRegex = /(px|rem)$/;
const numberRegex = /^([-0-9.]+)/;

module.exports = stylelint.createPlugin(ruleName, (primaryOption, secondaryOptionObject, context) => {
  const secondaryOptions = secondaryOptionObject || {};
  return (root, result) => {
    const validOptions = stylelint.utils.validateOptions(
      result,
      ruleName,
      {
        actual: secondaryOptions,
        possible: {
          pxPerRem: (value) => value % 1 === 0,
          ignoreList: [isString],
        },
      },
    );

    if (!validOptions) {
      return;
    }
    const pxPerRem = Number(secondaryOptions.pxPerRem) || PX_PER_REM;
    const ignoreList = secondaryOptions.ignoreList || [];

    const isAutoFixing = Boolean(context.fix);

    const isValid = (value, unit) => {
      if (unit === 'px') return Number.isInteger(value);
      if (unit === 'rem') return Number.isInteger(value * pxPerRem);
      return false;
    };

    const suggestFix = (value, unit) => {
      if (unit === 'px') return `${Math.round(value)}px`;
      if (unit === 'rem') return `${Math.round(value * pxPerRem) / pxPerRem}rem`;
      return undefined;
    };

    const handleValue = (decl, value) => {
      if (!unitRegex.test(value)) return;
      const matched = value.match(numberRegex);
      if (!matched) return;
      const valueNumberString = matched[0];
      const valueNumber = parseFloat(valueNumberString);
      const unit = value.replace(valueNumberString, '');

      if (isValid(valueNumber, unit)) return;
      const suggestedValue = suggestFix(valueNumber, unit);
      if (isAutoFixing) {
        decl.value = decl.value.replace(value, suggestedValue);
      } else {
        stylelint.utils.report({
          ruleName,
          result,
          node: decl,
          message: messages.expected(value, suggestedValue),
          word: value,
        });
      }
    };

    root.walkDecls((decl) => {
      if (!decl.value || ignoreList.includes(decl.prop)) return;
      const values = postcss.list.space(decl.value);
      if (!values?.length) return;
      values.forEach((value) => handleValue(decl, value));
    });
  };
});

module.exports.ruleName = ruleName;
module.exports.messages = messages;
