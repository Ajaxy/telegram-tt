/**
 * @fileoverview Forbid usage of getActions in actions
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
      description: "Forbid usage of getActions in action handlers",
      recommended: false,
      url: null,
    },
    fixable: null,
    schema: [],
    messages: {
      noGetActionsInActions: "Do not use getActions inside action handlers, instead use the second argument of the action handler",
    }
  },

  create(context) {
    return {
      CallExpression: (node) => {
        if(!context.getPhysicalFilename().substring(context.getCwd().length).startsWith('/src/global')) return;
        if(node.callee.name === 'getActions') {
          context.report({
            node,
            messageId: 'noGetActionsInActions',
          })
        }
      }
    };
  },
};
