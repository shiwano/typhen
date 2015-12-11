namespace Module1.Module2 {
  export function methodDecorator(target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>): void { }

  /**
   * Comment
   */
  export function func(): void { }

  export class A {
    @methodDecorator
    method(): void { }
  }
}
