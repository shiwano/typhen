# typhen [![Build Status](https://secure.travis-ci.org/shiwano/typhen.png?branch=master)](http://travis-ci.org/shiwano/typhen) [![npm version](https://badge.fury.io/js/typhen.svg)](http://badge.fury.io/js/typhen)

> Generates code or documentation from TypeScript.

The definition and the template given:

```ts
interface Foo {
  bar: string;
  baz(qux: string): void;
}
```

```hbs
class {{name}} {
  {{#each properties}}
  public {{type}} {{upperCamelCase name}} { get; set; }
  {{/each}}
  {{#each methods}}
  {{#each callSignatures}}
  public {{returnType}} {{upperCamelCase ../name}}({{#each parameters}}{{type}} {{name}}{{#unless @last}}, {{/unless}}{{/each}}): {
    // do something
  }
  {{/each}}
  {{/each}}
}
```

Will generate this below:

```cs
class Foo {
  public string Bar { get; set; }
  public void Baz(string qux) {
    // do something
  }
}
```

## Getting Started
Install the module with: `npm install -g typhen`

If typhenfile.js exists in the current directory:

```sh
$ typhen
```

Otherwise:

```sh
$ typhen foo/bar/typhenfile.js
```

```sh
$ typhen --plugin typhen-awesome-plugin --dest generated tsconfig.json
```

```sh
$ typhen --plugin typhen-awesome-plugin --dest generated definitions.d.ts
```

## Documentation

### typhenfile.js
The typhenfile.js is a valid JavaScript file that belongs in the root directory of your project, and should be committed with your project source.

The typhenfile.js is comprised of the following parts:

* The "wrapper" function that returns a Promise object of the [bluebird](https://github.com/petkaantonov/bluebird).
* Loading or creating a plugin.
* Running with configuration.

Example:

```js
module.exports = function(typhen) {
  var tsconfig = require('./tsconfig.json');

  return typhen.run({
    plugin: typhen.loadPlugin('typhen-awesome-plugin', {
      optionName: 'option value'
    }),
    src: tsconfig.files,
    dest: 'generated',
    compilerOptions: tsconfig.compilerOptions
  });
};
```

```js
module.exports = function(typhen) {
  return typhen.run({                    // typhen.run returns a Promise object of the bluebird.
    plugin: typhen.loadPlugin('typhen-awesome-plugin', {
      optionName: 'option value'
    }),
    src: 'typings/lib/definitions.d.ts', // string or string[]
    dest: 'generated',
    cwd: '../other/current',             // Optional. Default value is process.cwd().
    typingDirectory: 'typings',          // Optional. Default value is the directory name of the src.
    defaultLibFileName: 'lib.core.d.ts', // Optional. Default value is undefined, then the typhen uses the lib.d.ts.
    compilerOptions: {                   // Optional. Default value is { module: 'commonjs', noImplicitAny: true, target: 'ES5' }
      target: 'ES6'
    }
  }).then(function(files) {
    console.log('Done!');
  }).catch(function(e) {
    console.error(e);
  });
};
```

### Plugin
A typhen plugin can be defined in the typhenfile.js or an external module.

Example:

```js
module.exports = function(typhen, options) {
  return typhen.createPlugin({
    pluginDirectory: __dirname,
    newLine: '\r\n',                   // Optional. Default value is '\n'.
    namespaceSeparator: '::',          // Optional. Default value is '.'.
    customPrimitiveTypes: ['integer'], // Optional. Default value is [].
    disallow: {                        // Optional. Default value is {}.
      any: true,
      tuple: true,
      unionType: true,
      intersectionType: true,
      overload: true,
      generics: true,
      anonymousObject: true,
      anonymousFunction: true
    },
    handlebarsOptions: {               // Optional. Default value is null.
      data: options,                   // For details, see: http://handlebarsjs.com/execution.html
      helpers: {
        baz: function(str) {
          return str + '-baz';
        }
      }
    },

    rename: function(symbol, name) { // Optional. Default value is a function that returns just the name.
      if (symbol.kind === typhen.SymbolKind.Array) {
        return '[]';
      }
      return name;
    },

    generate: function(generator, types, modules) {
      generator.generateUnlessExist('templates/README.md', 'README.md');

      types.forEach(function(type) {
        switch (type.kind) {
          case typhen.SymbolKind.Enum:
            generator.generate('templates/enum.hbs', 'underscore:**/*.rb', type);
            break;
          case typhen.SymbolKind.Interface:
          case typhen.SymbolKind.Class:
            generator.generate('templates/class.hbs', 'underscore:**/*.rb', type);
            break;
        }
      });
      modules.forEach(function(module) {
        generator.generate('templates/module.hbs', 'underscore:**/*.rb', module);
      });
      generator.files.forEach((file) => {
        // Change a file that will be written.
      });
      return new Promise(function(resolve, reject) { // If you want async processing, return a Promise object.
        // Do async processing.
      });
    }
  });
};
```

### Templating
The typhen has used the [Handlebars template engine](http://handlebarsjs.com/) to render code, so you can use the following global helpers and custom helpers which are defined in the typhenfile.js or a plugin.

#### and Helper
Conditionally render a block if all values are truthy.

Usage:
```hbs
    {{#and type.isInterface type.isGenericType type.typeArguments}}
      This type is an instantiation of a generic interface.
    {{/and}}
```

#### or Helper
Conditionally render a block if one of the values is truthy.

Usage:
```hbs
    {{#or type.isArray type.isTuple type.isClass}}
      This type is an array, a tuple, or a class.
    {{/or}}
```

#### underscore Helper
Transforms a string to underscore.

Usage:
```hbs
    {{underscore 'FooBarBaz'}}
                  foo_bar_baz
```

#### upperCamelCase Helper
Transforms a string to upper camel case.

Usage:
```hbs
    {{upperCamelCase 'foo_bar_baz'}}
                      FooBarBaz
```

#### lowerCamelCase Helper
Transforms a string to lower camel case.

Usage:
```hbs
    {{lowerCamelCase 'foo_bar_baz'}}
                      fooBarBaz
```

#### pluralize
Transforms a string to plural form.

Usage:
```hbs
    {{pluralize 'person'}}
                 people
```

#### singularize
Transforms a string to singular form.

Usage:
```hbs
    {{singularize 'people'}}
                   person
```

#### defaultValue
Render a fallback value if a value doesn't exist.

Usage:
```hbs
    {{defaultValue noExistingValue 'missing'}}
                   missing
```

### Custom Primitive Types
If you want to use a custom primitive type, you will add the interface name to `customPrimitiveTypes` option in your plugin. Then the typhen will parse the interface as a primitive type.

## Plugins
If you want to add your project here, feel free to submit a pull request.

* [typhen-json-schema](https://github.com/shiwano/typhen-json-schema) - Converts TypeScript Interfaces to JSON Schema

## TypeScript Version
1.7.3

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [gulp.js](http://gulpjs.com/).

## Contributors

* Shogo Iwano (@shiwano)
* Sebastian Lasse (@sebilasse)

## License
Copyright (c) 2014 Shogo Iwano
Licensed under the MIT license.
