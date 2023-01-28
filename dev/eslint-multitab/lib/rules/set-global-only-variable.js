/**
 * @fileoverview setGlobal must only be used with 'global' variable
 * @author undrfined
 */
"use strict";

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "setGlobal must only be used with 'global' variable",
      recommended: false,
      url: null,
    },
    fixable: null,
    schema: [],
    hasSuggestions: true,
    messages: {
      setGlobalOnlyVariable: "setGlobal must only be used with 'global' variable",
    }
  },

  create(context) {
    return {
      CallExpression: (node) => {
        if(node.callee.name === 'setGlobal') {
          if(node.arguments[0] && node.arguments[0].type !== 'Identifier' || node.arguments[0].name !== 'global') {
            context.report({
              node,
              messageId: 'setGlobalOnlyVariable',
              ...(node.parent.type === 'ExpressionStatement' && {
                suggest: [{
                  desc: "Move the global assignment before the setGlobal call",
                  *fix(fixer) {
                    const sc = context.getSourceCode();
                    const parent = node.parent;
                    yield fixer.insertTextBefore(parent, 'global = ' + sc.getText(node.arguments[0]) + ';\n');
                    yield fixer.replaceText(node.arguments[0], 'global');
                  },
                }]
              }),
            })
          }
        }
      }
    };
  },
};
