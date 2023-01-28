/**
 * @fileoverview No immediate global
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
      description: "No immediate global",
      recommended: false,
      url: null,
    },
    fixable: null,
    schema: [],
    messages: {
      noImmediateGlobal: "Only use getGlobal() to assign to global variable",
    }
  },

  create(context) {
    return {
      CallExpression: (node) => {
        if(!context.getPhysicalFilename().substring(context.getCwd().length).startsWith('/src/global')) return;
        if(node.callee.name === 'getGlobal'
            && node.parent.type !== 'AssignmentExpression'
        ) {
          context.report({
            node,
            messageId: "noImmediateGlobal",
          })
        }
      }
    };
  },
};
