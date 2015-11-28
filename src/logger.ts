import chalk = require('chalk');

namespace Logger {
  export enum LogLevel {
    Debug,
    Info,
    Warning,
    Error,
    Silent
  }

  export let level: LogLevel = LogLevel.Info;
  export function debug(...texts: any[]): void { logWithInfo(LogLevel.Debug, texts, chalk.gray('DEBUG').toString()); }
  export function info(...texts: any[]):  void { logWithInfo(LogLevel.Info, texts); }
  export function warn(...texts: any[]):  void { logWithInfo(LogLevel.Warning, texts, chalk.yellow('WARN').toString()); }
  export function error(...texts: any[]): void { logWithInfo(LogLevel.Error, texts, chalk.red('ERROR').toString()); }

  export function log(...texts: any[]): void {
    if (level === LogLevel.Silent) { return; }
    console.log(texts.join(' '));
  }

  export function underline(text: string): string { return chalk.underline(text).toString(); }
  export function green(text: string):     string { return chalk.green(text).toString(); }
  export function red(text: string):       string { return chalk.red(text).toString(); }
  export function cyan(text: string):      string { return chalk.cyan(text).toString(); }

  export function enableColor(color: boolean): void {
    chalk.enabled = color;
  }

  export function getDateTimeString(): string {
    let date = new Date();
    return [date.getHours(), date.getMinutes(), date.getSeconds()]
      .map(n => n.toString())
      .map(n => n.length === 1 ? '0' + n : n)
      .join(':');
  }

  function logWithInfo(logLevel: LogLevel, texts: any[], kind: string = ''): void {
    if (logLevel < level) { return; }

    if (kind.length > 0) { kind = '[' + kind + ']'; }
    Logger.log('[' + chalk.grey(Logger.getDateTimeString()) + ']' + kind, texts.join(' '));
  }
}

export = Logger;
