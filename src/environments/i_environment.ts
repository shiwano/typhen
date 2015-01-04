/// <reference path="../../typings/tsd.d.ts" />

interface IEnvironment {
  currentDirectory: string;
  newLine: string;
  useCaseSensitiveFileNames: boolean;
  defaultLibFileName: string;

  readFile(fileName: string): string;
  writeFile(fileName: string, data: string): void;
  resolvePath(...pathSegments: string[]): string;
  relativePath(...pathSegments: string[]): string;
  dirname(fileName: string): string;
  exists(fileName: string): boolean;
}

export = IEnvironment;
