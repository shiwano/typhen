/* tslint:disable: no-unused-variable class-name */

interface ToPrimitive {
  [Symbol.toPrimitive](hint: "default"): string;
  [Symbol.toPrimitive](hint: "string"): string;
  [Symbol.toPrimitive](hint: "number"): number;
  [Symbol.toPrimitive](hint: string): string | number;
}
