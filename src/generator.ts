/// <reference path="../typings/tsd.d.ts" />

import _ = require('lodash');
import inflection = require('inflection');

import IEnvironment = require('./environments/i_environment');
import Symbol = require('./symbol');
import Plugin = require('./plugin');
import LocalHandlebars = require('./local_handlebars');

class Generator {
  private fileDataCache: { [index: string]: string } = {};
  private templateCache: { [index: string]: HandlebarsTemplateDelegate } = {};

  constructor(
      public outputDirectory: string,
      public env: IEnvironment,
      public pluginEnv: IEnvironment,
      private handlebarsOptions: Plugin.IHandlebarsOptions,
      private onGenerate?: (fileName: string) => void) {
  }

  public generateUnlessExist(src: string, dest: string, context: Object = null): string {
    return this.generate(src, dest, context, false);
  }

  public generate(src: string, dest: string, overwrite?: boolean): string;
  public generate(src: string, dest: string, context: Object, overwrite?: boolean): string;
  public generate(src: string, dest: string, context: any, overwrite?: boolean): string {
    if (_.isBoolean(context)) {
      overwrite = <boolean>context;
      context = null;
    }

    var data = context !== null && /^.+\.hbs$/.test(src) ?
      this.getTemplate(src)(context, this.handlebarsOptions) :
      this.getFile(src);

    if (context instanceof Symbol.Type) {
      dest = this.replaceStarsOfFileName(dest, <Symbol.Type>context);
    }
    var resolvedDest = this.env.resolvePath(this.outputDirectory, dest);

    if (_.contains([true, undefined], overwrite) || !this.env.exists(resolvedDest)) {
      this.env.writeFile(resolvedDest, data);

      if (this.onGenerate !== undefined) {
        this.onGenerate(resolvedDest);
      }
    }
    return data;
  }

  public replaceStarsOfFileName(fileName: string, type: Symbol.Type): string {
    var matches = fileName.match(/(underscore|upperCamelCase|lowerCamelCase)?:?(.*\*.*)/);
    if (matches == null) { return fileName; }

    return matches[2]
      .replace('**', type.moduleNames.map(n => this.inflect(n, matches[1])).join('/'))
      .replace('*', this.inflect(type.name, matches[1]))
      .replace(/^\//, ''); // Avoid making an absolute path
  }

  private inflect(name: string, inflectionType: string): string {
    switch (inflectionType) {
      case 'underscore':     return inflection.underscore(name);
      case 'upperCamelCase': return inflection.camelize(name);
      case 'lowerCamelCase': return inflection.camelize(name, true);
      default:               return name;
    }
  }

  private getFile(fileName: string): string {
    var filePath = this.pluginEnv.resolvePath(fileName);

    if (!this.fileDataCache[filePath]) {
      this.fileDataCache[filePath] = this.pluginEnv.readFile(filePath);
    }
    return this.fileDataCache[filePath];
  }

  private getTemplate(templateName: string): HandlebarsTemplateDelegate {
    var filePath = this.pluginEnv.resolvePath(templateName);

    if (!this.templateCache[filePath]) {
      var templateSource = this.getFile(filePath);
      this.templateCache[filePath] = LocalHandlebars.handlebars.compile(templateSource);
    }
    return this.templateCache[filePath];
  }
}

export = Generator;
