/// <reference path="../typings/tsd.d.ts" />

import _ = require('lodash');
import chalk = require('chalk');

class Logger {
  public static get colored(): boolean { return chalk.enabled; }
  public static set colored(value: boolean) { chalk.enabled = value; }

  public static underline(text: string): string { return chalk.underline(text).toString(); }
  public static green(text: string): string { return chalk.green(text).toString(); }
  public static red(text: string): string { return chalk.red(text).toString(); }
  public static cyan(text: string): string { return chalk.cyan(text).toString(); }

  public static info(...texts: any[]): void { Logger.logWithInfo(texts); }
  public static warn(...texts: any[]): void { Logger.logWithInfo(texts, chalk.yellow('WARN').toString()); }
  public static error(...texts: any[]): void { Logger.logWithInfo(texts, chalk.red('ERROR').toString()); }

  public static log(...texts: any[]): void {
    console.log(texts.join(' '));
  }

  public static getDateTimeString(): string {
    var date = new Date();
    return [date.getHours(), date.getMinutes(), date.getSeconds()]
      .map(n => n.toString())
      .map(n => n.length === 1 ? '0' + n : n)
      .join(':');
  }

  private static logWithInfo(texts: any[], kind: string = ''): void {
    if (kind.length > 0) { kind = '[' + kind + ']'; }
    Logger.log('[' + chalk.grey(this.getDateTimeString()) + ']' + kind, texts.join(' '));
  }
}

export = Logger;
