/* tslint:disable: no-unused-variable class-name */

type MappedType<T> = {
  [P in keyof T]?: T[P];
};
interface MappedTypeParam {
  foo: number;
}
type RealMappedType = MappedType<MappedTypeParam>;
