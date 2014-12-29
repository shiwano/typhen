'use strict';

module.exports = function(typhen) {
  var plugin = typhen.loadPlugin('./test/fixtures/plugin/typhen-test', {
    author: 'shiwano'
  });

  typhen.run({
    plugin: plugin,
    src: 'test/fixtures/typings/definitions.d.ts',
    dest: '.tmp/generated'
  });
};
