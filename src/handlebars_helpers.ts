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
  export function underscore(str: string): string {
    return inflection.underscore(str);
  }

  export function upperCamelCase(str: string): string {
    return inflection.camelize(str);
  }

  export function lowerCamelCase(str: string): string {
    return inflection.camelize(str, true);
  }
}
