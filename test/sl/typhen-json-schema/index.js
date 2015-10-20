'use strict';

var fs = require('fs');
var _ = require('lodash');
var inflection = require('inflection');
var jsesc = require('jsesc');

var keywords = {
  string: {
    minLength: 'number',
    maxLength: 'number',
    pattern: 'string',
    format: 'string',
    default: 'string'
  },
  number: {
    multipleOf: 'number',
    minimum: 'number',
    maximum: 'number',
    exclusiveMinimum: 'boolean',
    exclusiveMaximum: 'boolean',
    default: 'number'
  },
  object: {
    minProperties: 'number',
    maxProperties: 'number'
  },
  array: {
    minItems: 'number',
    maxItems: 'number',
    uniqueItems: 'boolean'
  }
};

module.exports = function(typhen, options) {
  options = _.defaults(options, {
    baseUri: '',
    enumType: 'integer'
  });

  function getEnumValues(enumSymbol) {
    return enumSymbol.members.map(function(m) {
      return options.enumType === 'string' ? '"' + m.name + '"' : m.value;
    }).join('');
  }

  function getPrimitive(type, tagTable){
    if (type.name === 'number' && tagTable.integer) {
      return '"type": "integer"';
    } else {
      return '"type": "' + type.name + '"';
    }
  }
  function getRef(type, tagTable){
    var pathSegments = _.flatten([type.ancestorModules.map(function(m) { return m.name; }), type.name], true);
    var typePath = pathSegments.map(function(s) { return inflection.underscore(s); }).join('/');
    return '"$ref": "' + options.baseUri + '/' + typePath + '.json"';
  }

  return typhen.createPlugin({
    pluginDirectory: __dirname,
    namespaceSeparator: '/',
    customPrimitiveTypes: ['integer'],
    /*
    disallow: {
      any: true,
      unionType: true
    },
    */
    handlebarsOptions: {
      data: options,
      partials: {
        object: fs.readFileSync(__dirname + '/templates/object.hbs', 'utf-8')
      },
      helpers: {
        escape: function(str) {
          return jsesc(str, { quotes: 'double' });
        },
        required: function(properties) {
          return properties.filter(function(p) {
            return !p.isOptional;
          }).map(function(p) {
            return '"' +  p.name + '"';
          }).join(', ');
        },
        keyword: function(type, tag) {
          var keywordsByType;
          if (type.name === 'number' || type.name === 'integer') {
            keywordsByType = keywords.number;
          } else if (type.name === 'string') {
            keywordsByType = keywords.string;
          } else if (type.isArray || type.isTuple) {
            keywordsByType = keywords.array;
          } else {
            keywordsByType = keywords.object;
          }
          if (_.isString(keywordsByType[tag.name])) {
            if (keywordsByType[tag.name] === 'string') {
              return '"' + tag.name + '": "' + tag.value + '",';
            } else {
              return '"' + tag.name + '": ' + tag[keywordsByType[tag.name]] + ',';
            }
          } else {
            typhen.logger.debug('Unsupported tag: ' + tag.name);
            return;
          }
        },
        typeProperty: function(type, tagTable) {
          if (type) {
            console.log('!!!',type);
            if (type.isPrimitiveType) {
              return getPrimitive(type, tagTable);
            } else if (type.isEnum) {
              return '"enum": [' + getEnumValues(type) + ']';
            } else if (type.isUnionType) {
              var anyOf = type.types.map(function(t){
                if (t && t.isPrimitiveType) {
                  return '{'+getPrimitive(t, tagTable)+'}';
                } else if (t) {
                  return '{'+getRef(t)+'}';
                }
              });
              console.log(anyOf);
              //var pathSegments = _.flatten([type.ancestorModules.map(function(m) { return m.name; }), type.name], true);
              //console.log(pathSegments);
              console.log('------ ------ ------');
              return ['"anyOf": [', anyOf, ']'].join('');
            } else {
              return getRef(type);
            }
          }
        }
      }
    },

    generate: function(generator, types) {
      types.forEach(function(type) {
        console.log(type);
        switch (type.kind) {
          case typhen.SymbolKind.Interface:
          case typhen.SymbolKind.Class:
            generator.generate('templates/base.hbs', 'underscore:**/*.json', type);
            break;
          case typhen.SymbolKind.ObjectType:
            generator.generate('templates/object.hbs', 'underscore:**/*.json', type);
            break;
        }
      });
    }
  });
};
