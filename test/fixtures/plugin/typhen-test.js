'use strict';

module.exports = function(typhen, options) {
  return typhen.createPlugin({
    pluginDirectory: __dirname,
    customPrimitiveTypes: ['integer'],
    handlebarsOptions: {
      data: options,
      helpers: {
        'link': function(text, url) {
          return '[' + text + '](' + url + ')';
        }
      }
    },

    rename: function(symbol, name) {
      if (symbol.kind === typhen.SymbolKind.Array) {
        return 'ArrayOf' + symbol.type.name;
      }
      return name;
    },

    generate: function(generator, types, modules) {
      generator.generateUnlessExist('templates/README.md', 'README.md');
      generator.generate('templates/plugin_test.hbs', 'plugin_test.md');
      generator.generateFiles('templates/files', '**/*.md', 'files');

      types.forEach(function(type) {
        switch (type.kind) {
          case typhen.SymbolKind.Enum:
            generator.generate('templates/enum.hbs', 'underscore:**/*.md', type);
            break;
          case typhen.SymbolKind.Tuple:
            generator.generate('templates/tuple.hbs', 'underscore:**/*.md', type);
            break;
          case typhen.SymbolKind.UnionType:
          case typhen.SymbolKind.IntersectionType:
            generator.generate('templates/union_or_intersection_type.hbs', 'underscore:**/*.md', type);
            break;
          case typhen.SymbolKind.Interface:
          case typhen.SymbolKind.Class:
            generator.generate('templates/interface.hbs', 'underscore:**/*.md', type);
            break;
          case typhen.SymbolKind.ObjectType:
            generator.generate('templates/object_type.hbs', 'underscore:**/*.md', type);
            break;
          case typhen.SymbolKind.Function:
            generator.generate('templates/function.hbs', 'underscore:**/*.md', type);
            break;
        }
      });

      modules.forEach(function(mod) {
        generator.generate('templates/module.hbs', 'underscore:**/*.md', mod);
      });
    }
  });
};
