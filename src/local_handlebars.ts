import * as _ from 'lodash';
import * as inflection from 'inflection';
import * as Handlebars from 'handlebars';

import * as helpers from './helpers';

export namespace HandlebarsHelpers {
  export function and(...valuesAndOptions: any[]): any {
    let options = _.last(valuesAndOptions);
    let values = valuesAndOptions.filter((i: any) => i !== options);

    if (_.every(values, (v: any) => !(<any>Handlebars).Utils.isEmpty(v))) {
      return options.fn(this);
    } else {
      return options.inverse(this);
    }
  }

  export function or(...valuesAndOptions: any[]): any {
    let options = _.last(valuesAndOptions);
    let values = valuesAndOptions.filter((i: any) => i !== options);

    if (_.any(values, (v: any) => !(<any>Handlebars).Utils.isEmpty(v))) {
      return options.fn(this);
    } else {
      return options.inverse(this);
    }
  }

  export function underscore(str: string): string {
    return helpers.underscore(str);
  }

  export function upperCamelCase(str: string): string {
    return helpers.upperCamelCase(str);
  }

  export function lowerCamelCase(str: string): string {
    return helpers.lowerCamelCase(str);
  }

  export function pluralize(str: string): string {
    return helpers.pluralize(str);
  }

  export function singularize(str: string): string {
    return helpers.singularize(str);
  }

  export function defaultValue(value: any, defaultValue: any): any {
    return value ? value : defaultValue;
  }
}

export function registerHelpers(handlebars: typeof Handlebars): void {
  _.forEach(HandlebarsHelpers, (helper: Function, helperName: string) => {
    handlebars.registerHelper(helperName, helper);
  });
}

export let handlebars: typeof Handlebars = (<any>Handlebars).create();
registerHelpers(handlebars);
