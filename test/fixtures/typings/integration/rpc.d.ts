/* tslint:disable: no-unused-variable class-name */

/// <reference path="./type.d.ts" />

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
