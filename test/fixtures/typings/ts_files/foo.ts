import Bar = require('./bar');

module A {
  export class Foo {
    constructor(public qux: string) {}
    print(): void {
      console.log(this.qux);
    }
  }
}

export = A;
