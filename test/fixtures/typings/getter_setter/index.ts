class GetterSetterClass {
  private fooValue: string;
  private barValue: string;
  private bazValue: string;

  get foo(): string { return this.fooValue; }
  set foo(foo: string) { this.fooValue = foo;  }

  get bar(): string { return this.barValue; }

  set baz(baz: string) { this.bazValue = baz;  }
}
