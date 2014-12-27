'use strict';

module.exports = function(typhen, Handlebars) {
  Handlebars.registerHelper('link', function(text, url) {
    text = Handlebars.Utils.escapeExpression(text);
    url = Handlebars.Utils.escapeExpression(url);
    var result = '[' + text + '](' + url + ')';
    return new Handlebars.SafeString(result);
  });

  return typhen.createPlugin({
    pluginDirectory: __dirname,
    defaultLibFileName: 'lib.d.ts',

    generate: function(types, generator) {
      generator.generateUnlessExist('templates/README.md', 'README.md');
      generator.generate('templates/helper_test.hbs', 'helper_test.md');

      types.forEach(function(type) {
        switch (type.flags) {
          case typhen.SymbolFlags.Enum:
            generator.generate('templates/enum.hbs', 'underscore:**/*.md', type);
            break;
          case typhen.SymbolFlags.Interface:
          case typhen.SymbolFlags.Class:
            if (type.name !== 'integer') {
              generator.generate('templates/generic_type.hbs', 'underscore:**/*.md', type);
            }
            break;
          case typhen.SymbolFlags.ObjectType:
            generator.generate('templates/object_type.hbs', 'underscore:**/*.md', type);
            break;
          case typhen.SymbolFlags.Function:
            generator.generate('templates/function.hbs', 'underscore:**/*.md', type);
            break;
        }
      });
    }
  });
};
