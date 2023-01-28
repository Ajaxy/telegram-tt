/**
 * @fileoverview Must specify action handler return type
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
      description: "Must specify action handler return type",
      recommended: false,
      url: null,
    },
    fixable: null,
    schema: [],
    messages: {
      mustSpecifyActionHandlerReturnType: "Must specify action handler return type",
    }
  },

  create(context) {
    return {
      ArrowFunctionExpression: (node) => {
        if(node.parent.type === "CallExpression" && node.parent.callee.name === 'addActionHandler' && !node.returnType) {
          context.report({
            node,
            messageId: "mustSpecifyActionHandlerReturnType",
          })
        }
      }
    };
  },
};
