function classDecorator<TFunction extends Function>(target: TFunction): TFunction {
  return target;
}

function propertyDecorator(num: number, str: string, bool: boolean, func: () => string): PropertyDecorator {
  return (target: Object, propertyKey: string | symbol) => { };
}

function methodDecorator(target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>): void {
}

function methodDecorator2(target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>): void {
}

function parameterDecorator(target: Object, propertyKey: string | symbol, parameterIndex: number): void {
}

@classDecorator
class DecoratedClass {
  @propertyDecorator(1, 'foo', true, function() { return '1'; })
  decoratedProperty: number;
  @propertyDecorator(-1, null, false, () => '2')
  decoratedProperty2: number;
  @methodDecorator2
  @methodDecorator
  decoratedMethod(@parameterDecorator arg: string): void { }
}
