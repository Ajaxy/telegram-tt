/**
 * @fileoverview Must update global after await
 * @author undrfined
 */
"use strict";

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

/** @type {import('eslint').Rule.RuleModule} */
// TODO This rule is not working properly
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Must update global after await",
      recommended: false,
      url: null,
    },
    fixable: null,
    schema: [],
    messages: {
      mustUpdateGlobalAfterAwait: "Global is outdated because of await here -> {{before}}, use global = getGlobal() to update",
    }
  },

  create(context) {
    let hasAssignmentOnBlockLevel;
    let blocks = 0;
    let d;
    let hasAwait = false;
    let hasAwaitOnBlockLevel;
    let assigned;

    //----------------------------------------------------------------------
    // Helpers
    //----------------------------------------------------------------------
    function endFunction() {
      hasAwait = false;
      assigned = undefined;
      d = undefined;
      hasAssignmentOnBlockLevel = undefined;
      hasAwaitOnBlockLevel = undefined;
    }

    //----------------------------------------------------------------------
    // Public
    //----------------------------------------------------------------------

    return {
      'FunctionDeclaration:exit': endFunction,
      'FunctionExpression:exit': endFunction,
      'ArrowFunctionExpression:exit': endFunction,
      'AwaitExpression:exit': (node) => {
        if(!node) return;
        hasAwait = true;
        hasAwaitOnBlockLevel = blocks;
        d = node;
      },
      'BlockStatement': () => {
        blocks += 1;
      },
      'BlockStatement:exit': () => {
        blocks -= 1;
        if(hasAwaitOnBlockLevel && blocks === hasAwaitOnBlockLevel) {
          hasAwaitOnBlockLevel = undefined;
        }
      },
      'ReturnStatement:exit': (node) => {
        if(hasAwait && hasAwaitOnBlockLevel && blocks === hasAwaitOnBlockLevel && node.parent.type === 'BlockExpression') {
          endFunction();
        }
      },
      'AssignmentExpression': (node) => {
        if(node.left.type !== "Identifier" || node.left.name !== "global") return;
        if(node.right.type !== "CallExpression" || node.right.callee.name !== "getGlobal") return;

        if(hasAwaitOnBlockLevel && blocks === hasAwaitOnBlockLevel) {
          hasAwait = false;
          hasAwaitOnBlockLevel = undefined;
          d = undefined;
        } else {
          hasAssignmentOnBlockLevel = blocks;
          assigned = node;
        }
      },
      Identifier: (node) => {
        if(node.name !== "global") return;
        if(node.parent === assigned) return;
        if(hasAwait) {
          if(hasAssignmentOnBlockLevel !== undefined && hasAssignmentOnBlockLevel <= blocks) {
            endFunction();
            return;
          }
          context.report({
            node,
            messageId: "mustUpdateGlobalAfterAwait",
            data: {
              before: d ? d.loc.start.line + ':' + d.loc.start.column : 'unknown'
            },
          })
        }
      },
      "Program:exit": endFunction,
    };
  },
};
