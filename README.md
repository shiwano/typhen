# typhen [![Build Status](https://secure.travis-ci.org/shiwano/typhen.png?branch=master)](http://travis-ci.org/shiwano/typhen) [![npm version](https://badge.fury.io/js/typhen.svg)](http://badge.fury.io/js/typhen)

> Generates the code from the TypeScript declaration source files.

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
$ typhen --plugin typhen-json-schema --dest generated definitions.d.ts
```

## Documentation

### typhenfile.js

The typhenfile.js is a valid JavaScript file that belongs in the root directory of your project, and should be committed with your project source.

The typhenfile.js is comprised of the following parts:

* The "wrapper" function which takes `typhen` and `Handlebars` as arguments.
* Loading or creating a plugin.
* Running configuration.

Example:

```js
module.exports = function(typhen) {
  var plugin = typhen.loadPlugin('typhen-awesome-plugin');

  typhen.run({
    plugin: plugin,
    src: 'definitions.d.ts',
    dest: 'generated',
    cwd: '../other/current', // Optional. Default value is process.cwd().
    aliases: {               // Optional. Default value is {}.
      'Foo': 'Bar'
    }
  });
};
```

### Plugin

A typhen plugin can be defined in the typhenfile.js or an external module.

Example:

```js
module.exports = function(typhen, Handlebars) {
  return typhen.createPlugin({
    pluginDirectory: __dirname,
    defaultLibFileName: 'lib.d.ts', // Optional. Default value is ''.
    newLine: '\r\n',                // Optional. Default value is '\n'.
    namespaceSeparator: '::',       // Optional. Default value is '.'.
    disallow: {                     // Optional. Default value is {}.
      typeParameter: true;
      method: true;
    },
    aliases: {                      // Optional. Default value is {}.
      '^(.+)Class$': '$1'
    },
    handlebarsOptions: {            // Optional. Default value is null.
      helpers: {                    // For details, see: http://handlebarsjs.com/execution.html
        'baz': function(str) {
          return str + '-baz';
        }
      }
    },

    generate: function(types, generator) {
      generator.generateUnlessExist('templates/README.md', 'README.md');

      types.forEach(function(type) {
        switch (type.flags) {
          case typhen.SymbolFlags.Enum:
            generator.generate('templates/enum.hbs', 'underscore:**/*.rb', type);
            break;
          case typhen.SymbolFlags.Interface:
          case typhen.SymbolFlags.Class:
          case typhen.SymbolFlags.ObjectType:
            generator.generate('templates/class.hbs', 'underscore:**/*.rb', type);
            break;
          case typhen.SymbolFlags.Function:
            generator.generate('templates/function.hbs', 'underscore:**/*.rb', type);
            break;
        }
      });
    }
  });
};
```

### Templating
The typhen has used the [Handlebars template engine](http://handlebarsjs.com/) to render the code, so you can use the following global helpers and custom helpers which are defined in the typhenfile.js or a plugin.

#### Swag Helpers
See the [documentation](http://elving.github.io/swag/) for the helpers in the Swag library.

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

## TypeScript Version

1.3.0

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [gulp.js](http://gulpjs.com/).

## License
Copyright (c) 2014 Shogo Iwano
Licensed under the MIT license.
