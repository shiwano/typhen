import * as _ from 'lodash';
import * as inflection from 'inflection';

function applyHelperToStringWithSeparator(str: any, helper: (str: string) => string): string {
  if (typeof str === 'string') {
    let separators = _.uniq(str.match(/[^a-z_0-9]+/gi));

    if (separators.length === 1) {
      return str.split(separators[0]).map(s => helper(s)).join(separators[0]);
    } else {
      return helper(str);
    }
  }
  return str.toString();
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
