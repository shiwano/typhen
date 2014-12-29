'use strict';

module.exports = function(typhen, options) {
  return typhen.createPlugin({
    pluginDirectory: __dirname,
    defaultLibFileName: 'lib.d.ts',
    handlebarsOptions: {
      data: options,
      helpers: {
        'link': function(text, url) {
          text = typhen.Handlebars.Utils.escapeExpression(text);
          url = typhen.Handlebars.Utils.escapeExpression(url);
          var result = '[' + text + '](' + url + ')';
          return new typhen.Handlebars.SafeString(result);
        }
      }
    },

    generate: function(types, generator) {
      generator.generateUnlessExist('templates/README.md', 'README.md');
      generator.generate('templates/plugin_test.hbs', 'plugin_test.md');

      types.forEach(function(type) {
        switch (type.kind) {
          case typhen.SymbolKinds.Enum:
            generator.generate('templates/enum.hbs', 'underscore:**/*.md', type);
            break;
          case typhen.SymbolKinds.Interface:
          case typhen.SymbolKinds.Class:
            if (type.name !== 'integer') {
              generator.generate('templates/generic_type.hbs', 'underscore:**/*.md', type);
            }
            break;
          case typhen.SymbolKinds.ObjectType:
            generator.generate('templates/object_type.hbs', 'underscore:**/*.md', type);
            break;
          case typhen.SymbolKinds.Function:
            generator.generate('templates/function.hbs', 'underscore:**/*.md', type);
            break;
        }
      });
    }
  });
};
