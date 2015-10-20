module.exports = function(typhen) {
  var plugin = typhen.loadPlugin('typhen-json-schema', {
    baseUri: 'http://example.com/my-schema',
    enumType: 'string'
  });

  return typhen.run({
    plugin: plugin,
    src: './interfaces.d.ts',
    dest: 'generated'
  });
};
