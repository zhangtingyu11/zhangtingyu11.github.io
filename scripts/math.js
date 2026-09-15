'use strict';

const fs = require('node:fs');
const path = require('node:path');
const katex = require('katex');

function render(tex, displayMode) {
  const result = katex.renderToString(tex, {
    displayMode,
    throwOnError: true,
    trust: false,
    output: 'htmlAndMathml'
  });
  return displayMode
    ? `<div class="paper-math" tabindex="0" role="group" aria-label="数学公式">${result}</div>`
    : result;
}

hexo.extend.filter.register('marked:extensions', extensions => {
  extensions.push({
    name: 'paperBlockMath', level: 'block',
    start: src => src.indexOf('$$'),
    tokenizer(src) {
      const match = /^\$\$\s*\n([\s\S]+?)\n\$\$(?:\n|$)/.exec(src);
      if (match) return { type: 'paperBlockMath', raw: match[0], tex: match[1] };
    },
    renderer: token => render(token.tex, true)
  }, {
    name: 'paperInlineMath', level: 'inline',
    start: src => src.indexOf('$'),
    tokenizer(src) {
      const match = /^\$(?!\$)([^\n$]+?)\$(?!\$)/.exec(src);
      if (match) return { type: 'paperInlineMath', raw: match[0], tex: match[1] };
    },
    renderer: token => render(token.tex, false)
  });
});

// Bundle matching CSS and fonts with the generated site; no runtime CDN dependency.
hexo.extend.generator.register('local-katex-assets', () => {
  const dist = path.resolve(path.dirname(require.resolve('katex')), '..', 'dist');
  const files = ['katex.min.css', ...fs.readdirSync(path.join(dist, 'fonts')).map(f => `fonts/${f}`)];
  return files.map(file => ({
    path: `assets/vendor/katex/${file}`,
    data: () => fs.createReadStream(path.join(dist, file))
  }));
});
