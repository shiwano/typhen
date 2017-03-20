import * as chalk from 'chalk';

namespace Logger {
  export enum LogLevel {
    Debug,
    Info,
    Warning,
    Error,
    Silent
  }

  export let level: LogLevel = LogLevel.Silent;
  export function setLevel(logLevel: LogLevel): void {
    level = logLevel;
  }

  export let colorEnabled: boolean = true;
  export function enableColor(enabled: boolean): void {
    colorEnabled = enabled;
  }

  export function debug(...texts: any[]): void { logWithInfo(LogLevel.Debug, texts, gray('DEBUG')); }
  export function info(...texts: any[]):  void { logWithInfo(LogLevel.Info, texts); }
  export function warn(...texts: any[]):  void { logWithInfo(LogLevel.Warning, texts, yellow('WARN')); }
  export function error(...texts: any[]): void { logWithInfo(LogLevel.Error, texts, red('ERROR')); }

  export function log(...texts: any[]): void {
    if (level === LogLevel.Silent) { return; }
    console.log(texts.join(' '));
  }

  export function underline(text: string): string { return colorEnabled ? chalk.underline(text).toString() : text; }
  export function gray(text: string):      string { return colorEnabled ? chalk.gray(text).toString() : text; }
  export function green(text: string):     string { return colorEnabled ? chalk.green(text).toString() : text; }
  export function red(text: string):       string { return colorEnabled ? chalk.red(text).toString() : text; }
  export function cyan(text: string):      string { return colorEnabled ? chalk.cyan(text).toString() : text; }
  export function yellow(text: string):    string { return colorEnabled ? chalk.yellow(text).toString() : text; }

  export function getDateTimeString(): string {
    const date = new Date();
    return [date.getHours(), date.getMinutes(), date.getSeconds()]
      .map(n => n.toString())
      .map(n => n.length === 1 ? '0' + n : n)
      .join(':');
  }

  function logWithInfo(logLevel: LogLevel, texts: any[], kind: string = ''): void {
    if (logLevel < level) { return; }

    if (kind.length > 0) { kind = '[' + kind + ']'; }
    Logger.log('[' + gray(Logger.getDateTimeString()) + ']' + kind, texts.join(' '));
  }
}

export = Logger;
