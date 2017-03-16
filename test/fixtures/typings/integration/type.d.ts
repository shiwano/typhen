/* tslint:disable: no-unused-variable class-name */

/// <reference path="./color/color.d.ts" />

declare function emitLog(text: string): void;

interface integer {}

declare module Type {
  interface Range<T> {
    start: T;
    end: T;
  }

  interface Point {
    readonly x: number;
    readonly y: number;
    set(x: number, y: number): void;
    set(args: [number, number]): void;
    new(x: number, y: number): Point;
    new(args: [number, number]): Point;
    new(...variadicArgs: number[]): Point;
  }

  interface Square {
    center: Point;
    margin?: number;

    /**
     * Size from 1 to 5 (highest).
     * @minimum 1
     * @maximum 5
     */
    size: integer;
  }

  interface ColoredSquare extends Square {
    /**
     * Default color is red.
     * @default Color.Red
     */
    color: Color;
    setColor(color: Color, callback?: (color: Color) => void): void;
  }

  interface SquareDictionary<T extends Square> {
    readonly [stringIndex: string]: T;
    [numberIndex: number]: T;
  }

  interface Transformer {
    (squeare: Square, scale : number): void;
  }

  class Line {
    color: Color;
    protected constructor(src: Point, dest: Point);
    setColor(color: Color, callback?: (color: Color) => void): void;
    private ownColor;
    protected draw(): void;
  }

  class LineDrawer {
    static lines: Line[];
    static draw(src: Point, dest: Point): Line;
  }

  type time = number | Date;

  interface Time {
    now: time;
  }

  abstract class AbstractClass {
    abstract abstractMethod(): void;
    abstract abstractProperty: number;
  }

  type Predicate<T> = (element: T) => boolean;

  interface A { a: string }
  interface B { b: string }
  interface C { c: string }
  type IntersectionType = A & B & C;

  var ESSymbol: symbol;

  function classDecorator<TFunction extends Function>(target: TFunction): TFunction;

  @classDecorator
  class DecoratedClass {
  }

  interface Animal {
    isCat(): this is Cat;
  }
  interface Cat extends Animal {
  }
  function isCat(a: any): a is Cat;

  let letString: string;
  const constString: string;

  namespace Namespace {}

  type stringLiteralType = "foobar";
  type booleanLiteralType = true;
  type numberLiteralType = 100;
  type nullType = null;
  type neverType = never;

  enum EnumLiterals { EnumLiteralA = 1, EnumLiteralB = 2, }
  type enumLiteralType = EnumLiterals.EnumLiteralA;
}
