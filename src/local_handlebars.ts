/// <reference path="../typings/tsd.d.ts" />

import _ = require('lodash');
import inflection = require('inflection');
import Handlebars = require('handlebars');
import Swag = require('swag');

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

export function registerHelpers(handlebars: typeof Handlebars): void {
  Swag.registerHelpers(handlebars);
  _.forEach(HandlebarsHelpers, (helper: Function, helperName: string) => {
    handlebars.registerHelper(helperName, helper);
  });
}

export var handlebars: typeof Handlebars = (<any>Handlebars).create();
registerHelpers(handlebars);
