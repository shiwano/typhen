import _ = require('lodash');
import inflection = require('inflection');
import Handlebars = require('handlebars');

import Helpers = require('./helpers');

export module HandlebarsHelpers {
  export function and(...valuesAndOptions: any[]): any {
    var options = _.last(valuesAndOptions);
    var values = valuesAndOptions.filter((i: any) => i !== options);

    if (_.every(values, (v: any) => !(<any>Handlebars).Utils.isEmpty(v))) {
      return options.fn(this);
    } else {
      return options.inverse(this);
    }
  }

  export function or(...valuesAndOptions: any[]): any {
    var options = _.last(valuesAndOptions);
    var values = valuesAndOptions.filter((i: any) => i !== options);

    if (_.any(values, (v: any) => !(<any>Handlebars).Utils.isEmpty(v))) {
      return options.fn(this);
    } else {
      return options.inverse(this);
    }
  }

  export function underscore(str: string): string {
    return Helpers.underscore(str);
  }

  export function upperCamelCase(str: string): string {
    return Helpers.upperCamelCase(str);
  }

  export function lowerCamelCase(str: string): string {
    return Helpers.lowerCamelCase(str);
  }

  export function pluralize(str: string): string {
    return Helpers.pluralize(str);
  }

  export function singularize(str: string): string {
    return Helpers.singularize(str);
  }

  export function defaultValue(value: any, defaultValue: any): any {
    return value !== null && value !== undefined ? value : defaultValue;
  }
}

export function registerHelpers(handlebars: typeof Handlebars): void {
  _.forEach(HandlebarsHelpers, (helper: Function, helperName: string) => {
    handlebars.registerHelper(helperName, helper);
  });
}

export var handlebars: typeof Handlebars = (<any>Handlebars).create();
registerHelpers(handlebars);
