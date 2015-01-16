/* tslint:disable: no-unused-variable */

/// <reference path="./color/color.d.ts" />

declare function emitLog(text: string): void;

declare module Type {
  interface Range<T> {
    start: T;
    end: T;
  }

  interface Point {
    x: number;
    y: number;
    set(x: number, y: number): void;
    set(args: [number, number]): void;
    new(x: number, y: number): Point;
    new(args: [number, number]): Point;
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
    [stringIndex: string]: T;
    [numberIndex: number]: T;
  }

  interface Transformer {
    (squeare: Square, scale : number): void;
  }

  class Line {
    color: Color;
    constructor(src: Point, dest: Point);
    setColor(color: Color, callback?: (color: Color) => void): void;
    private ownColor;
    private draw();
  }

  class LineDrawer {
    static lines: Line[];
    static draw(src: Point, dest: Point): Line;
  }
}

declare module Rpc {
  export import RpcType = Type;
  export import Transformer = RpcType.Transformer;
  var type: typeof Type;
  var baseUrl: string;
  var anyAny: any;

  module Get {
    function getRange(start: Type.Point, dest: Type.Point): { range: RpcType.Range<number> };
  }

  module Post {
    function setOptions(options: { [index: string]: string }): boolean;
  }
}
