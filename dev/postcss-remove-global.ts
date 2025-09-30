import type { Plugin } from 'postcss';

const pluginName = 'postcss-remove-global';

function removeGlobalPlugin(): Plugin {
  return {
    postcssPlugin: pluginName,
    Once(root, helpers) {
      const file = helpers.result.opts.from || '';
      const isModule = /\.module\.(css|scss|sass)$/i.test(file);
      if (isModule) {
        return;
      }

      // :global in rules
      root.walkRules((rule) => {
        // :global as nested selector
        const globalReg = /:global(\s+)/;
        // :global(.selector) as nested selector
        const globalWithSelectorReg = /:global\(\s*((?:[a-zA-Z0-9.#:[\]_\-\s>+~]+))\s*\)/;
        if (rule.selector === ':global') {
          const parent = rule.parent || root;
          parent.append(...rule.nodes);
          rule.remove();
        } else if (rule.selector.match(globalReg)) {
          rule.selector = rule.selector.replace(globalReg, '');
        } else if (rule.selector.match(globalWithSelectorReg)) {
          rule.selector = rule.selector.replace(globalWithSelectorReg, '$1');
        }
      });
      // :global in AtRules
      root.walkAtRules((atRule) => {
        const name = atRule.name;
        const params = atRule.params;
        const globalReg = /:global\((\w+)\)/;
        if (name === 'keyframes' && params.match(globalReg)) {
          atRule.params = params.replace(globalReg, '$1');
        }
      });
    },
  };
}

removeGlobalPlugin.postcss = true;

export default removeGlobalPlugin;
