# typhen [![Build Status](https://secure.travis-ci.org/shiwano/typhen.png?branch=master)](http://travis-ci.org/shiwano/typhen) [![npm version](https://badge.fury.io/js/typhen.svg)](http://badge.fury.io/js/typhen)

Generates the code from the TypeScript declaration source files.

For example, from the TypeScript definition:

```ts
interface Foo {
  bar: string;
  baz(qux: string): void;
}
```

Generates the code in another language like this.

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

else:

```sh
$ typhen foo/bar/typhenfile.js
```

```sh
$ typhen --plugin typhen-json-schema --dest generated definitions.d.ts
```

## Documentation

### typhenfile.js

The typhenfile.js is a valid JavaScript file that belongs in the root directory of your project, and should be committed with your project source.

A typhenfile.js is comprised of the following parts:

* The "wrapper" function which takes `typhen` and `Handlebars` as arguments.
* Loading or creating a plugin.
* Running configuration.

A Sample is [here](test/fixtures/typhenfile.js)

### Plugin

A typhen plugin can be defined in typhenfile.js, or external module.

A Sample is [here](test/fixtures/plugin/typhen-test.js)

### Templating
The typhen has used [Handlebars template engine](http://handlebarsjs.com/) to render the code. So you can use the following built-in helpers and custom helpers which are defined in the typhenfile.js or the plugin.

#### Swag library helpers
See [Documentation](http://elving.github.io/swag/) for the helpers in the Swag library.

#### underscore
Transforms a string to underscore.

Usage:
```hbs
    {{underscore 'FooBarBaz'}}
                  foo_bar_baz
```

#### upperCamelCase
Transforms a string to upper camel case.

Usage:
```hbs
    {{upperCamelCase 'foo_bar_baz'}}
                      FooBarBaz
```

#### lowerCamelCase
Transforms a string to lower camel case.

Usage:
```hbs
    {{lowerCamelCase 'foo_bar_baz'}}
                      fooBarBaz
```

## Examples

The typhenfile.js in general.

```js
module.exports = function(typhen) {
  var plugin = typhen.loadPlugin('typhen-json-schema');

  typhen.run({
    plugin: plugin,
    src: 'definitions.d.ts',
    dest: 'schemata'
  });
};
```

And you can create a custom plugin in typhenfile.js.

```js
module.exports = function(typhen, Handlebars) {
  Handlebars.registerHelper('link', function(text, url) {
    text = Handlebars.Utils.escapeExpression(text);
    url = Handlebars.Utils.escapeExpression(url);
    var result = '[' + text + '](' + url + ')';
    return new Handlebars.SafeString(result);
  });

  var plugin = typhen.createPlugin({
    pluginDirectory: __dirname,
    defaultLibFileName: 'lib.d.ts',

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

  typhen.run({
    plugin: plugin,
    src: 'definitions.d.ts',
    dest: 'generated'
  });
};
```

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [gulp.js](http://gulpjs.com/).

## License
Copyright (c) 2014 Shogo Iwano
Licensed under the MIT license.
