/// <reference path="../typings/tsd.d.ts" />

import _ = require('lodash');
import inflection = require('inflection');
import Handlebars = require('handlebars');

export function registerHelpers(handlebars: typeof Handlebars): void {
  _.forEach(HandlebarsHelpers, (helper: Function, helperName: string) => {
    Handlebars.registerHelper(helperName, helper);
  });
}

module HandlebarsHelpers {
  export function underscore(str: string): hbs.SafeString {
    var result = inflection.underscore(str);
    return new Handlebars.SafeString(result);
  }

  export function upperCamelCase(str: string): hbs.SafeString {
    var result = inflection.camelize(str);
    return new Handlebars.SafeString(result);
  }

  export function lowerCamelCase(str: string): hbs.SafeString {
    var result = inflection.camelize(str, true);
    return new Handlebars.SafeString(result);
  }
}
