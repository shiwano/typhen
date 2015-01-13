/// <reference path="../typings/tsd.d.ts" />

import _ = require('lodash');
import inflection = require('inflection');
import Handlebars = require('handlebars');

function applyHelperToStringWithSeparator(str: string, helper: (str: string) => string): string {
  var separators = _.uniq(str.match(/[^a-z_]+/gi));

  if (separators.length === 1) {
    return str.split(separators[0]).map(s => helper(s)).join(separators[0]);
  } else {
    return helper(str);
  }
}

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
    return applyHelperToStringWithSeparator(str, inflection.underscore);
  }

  export function upperCamelCase(str: string): string {
    return applyHelperToStringWithSeparator(str, inflection.camelize);
  }

  export function lowerCamelCase(str: string): string {
    return applyHelperToStringWithSeparator(str, s => {
      return inflection.camelize(s, true);
    });
  }

  export function pluralize(str: string): string {
    return inflection.pluralize(str);
  }

  export function singularize(str: string): string {
    return inflection.singularize(str);
  }
}

export function registerHelpers(handlebars: typeof Handlebars): void {
  _.forEach(HandlebarsHelpers, (helper: Function, helperName: string) => {
    handlebars.registerHelper(helperName, helper);
  });
}

export var handlebars: typeof Handlebars = (<any>Handlebars).create();
registerHelpers(handlebars);
