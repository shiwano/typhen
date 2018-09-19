import * as _ from 'lodash';
import * as inflection from 'inflection';

import * as config from './config';

export enum SymbolKind {
  /** @internal */
  Invalid,
  Module,
  PrimitiveType,
  Enum,
  EnumMember,
  ObjectType,
  Interface,
  Class,
  Array,
  Function,
  TypeParameter,
  Tuple,
  UnionType,
  IntersectionType,
  IndexType,
  IndexedAccessType,
  StringLiteralType,
  BooleanLiteralType,
  NumberLiteralType,
  EnumLiteralType,
  Property,
  Method,
  Signature,
  Parameter,
  Variable,
  TypeAlias
}

export interface ObjectTable<T> {
  [name: string]: T;
}

export class Tag {
  constructor(
      public name: string,
      public value: string = '') {
  }

  get number(): number {
    const n = Number(this.value);
    return typeof n === 'number' ? n : 0;
  }

  get boolean(): boolean {
    return this.value !== 'false';
  }

  toString(): string {
    return this.value;
  }
}

export class DeclarationInfo {
  constructor(
      public fileName: string,
      public path: string,
      public fullText: string,
      public lineAndCharacterNumber: {
        line: number;
        character: number;
      }) {
  }

  toString(): string {
    return this.fileName +
      '(' + this.lineAndCharacterNumber.line + ',' +
      this.lineAndCharacterNumber.character + ')';
  }
}

export class Decorator {
  get name(): string {
    return this.decoratorFunction.name;
  }

  get parameters(): Parameter[] {
    return this.arguments.length > 0 ? this.decoratorFunction.callSignatures[0].parameters : [];
  }

  get arguments(): any[] {
    return <any[]>_.values(this.argumentTable);
  }

  constructor(
      public decoratorFunction: Function,
      public argumentTable: ObjectTable<any>) {
  }

  toString(): string {
    return this.name;
  }
}

export class TypePredicate {
  constructor(
      public type: Type,
      public thisType: Type,
      public parameter: Parameter) {
  }

  toString(): string {
    return this.parameter ?
      this.parameter.name + ' is ' + this.type.name :
      this.thisType.toString() + ' is ' + this.type.name;
  }
}

export class IndexInfo {
  constructor(public type: Type,
      public isReadonly: boolean = false) {
  }

  toString(): string {
    return this.type.name;
  }
}

export class Symbol {
  private static tagPattern: RegExp = /^\s*@([^\s@]+)\s*([^\s@]*)\s*$/m;
  kind: SymbolKind = SymbolKind.Invalid;
  private isDestroyed: boolean = false;

  constructor(
      protected config: config.Config,
      public rawName: string,
      public docComment: string[],
      public declarationInfos: DeclarationInfo[],
      public decorators: Decorator[],
      public parentModule: Module | null,
      protected rawAssumedName: string) {
  }

  get name(): string {
    return this.config.plugin.rename(this, this.nameWithoutRenaming);
  }

  private get nameWithoutRenaming(): string {
    return _.isEmpty(this.assumedName) ? this.rawName : this.assumedName;
  }

  get assumedName(): string {
    return this.rawAssumedName;
  }

  get fullName(): string {
    if (this.parentModule === null) { return this.name; }
    return [this.namespace, this.name].join(this.config.plugin.namespaceSeparator);
  }

  get rawFullName(): string {
    const namespace = this.ancestorModules.map(s => s.nameWithoutRenaming).join('.');
    return [namespace, this.nameWithoutRenaming].join('.');
  }

  get namespace(): string {
    return this.ancestorModules.map(s => s.name).join(this.config.plugin.namespaceSeparator);
  }

  get ancestorModules(): Module[] {
    return _.tap([], (results: Module[]) => {
      let parentModule = this.parentModule;
      while (parentModule !== null) {
        results.push(parentModule);
        parentModule = parentModule.parentModule;
      }
    }).reverse();
  }

  get comment(): string {
    return this.docComment
      .filter(c => !Symbol.tagPattern.test(c))
      .join(this.config.plugin.newLine);
  }

  get tagTable(): ObjectTable<Tag> {
    return <ObjectTable<Tag>>_.reduce(this.docComment, (result, comment) => {
      const matches = comment.match(Symbol.tagPattern);
      if (matches != null) { result[matches[1]] = new Tag(matches[1], matches[2]); }
      return result;
    }, <ObjectTable<Tag>>{});
  }

  get tags(): Tag[] {
    return <Tag[]>_.values(this.tagTable);
  }

  get isAnonymous(): boolean { return this.rawName.length <= 0; }
  get isAnonymousType(): boolean { return this.isType && this.isAnonymous; }
  get isGenericType(): boolean { return false; }
  get isGlobalModule(): boolean { return false; }

  get isType(): boolean { return this instanceof Type; }
  get isModule(): boolean { return this.kind === SymbolKind.Module; }
  get isPrimitiveType(): boolean { return this.kind === SymbolKind.PrimitiveType; }
  get isEnum(): boolean { return this.kind === SymbolKind.Enum; }
  get isEnumMember(): boolean { return this.kind === SymbolKind.EnumMember; }
  get isObjectLikeType(): boolean { return this instanceof ObjectLikeType; }
  get isObjectType(): boolean { return this.kind === SymbolKind.ObjectType; }
  get isInterface(): boolean { return this.kind === SymbolKind.Interface; }
  get isClass(): boolean { return this.kind === SymbolKind.Class; }
  get isArray(): boolean { return this.kind === SymbolKind.Array; }
  get isFunction(): boolean { return this.kind === SymbolKind.Function; }
  get isTypeParameter(): boolean { return this.kind === SymbolKind.TypeParameter; }
  get isTuple(): boolean { return this.kind === SymbolKind.Tuple; }
  get isUnionType(): boolean { return this.kind === SymbolKind.UnionType; }
  get isIntersectionType(): boolean { return this.kind === SymbolKind.IntersectionType; }
  get isIndexType(): boolean { return this.kind === SymbolKind.IndexType; }
  get isIndexedAccessType(): boolean { return this.kind === SymbolKind.IndexedAccessType; }
  get isLiteralType(): boolean { return this instanceof LiteralType; }
  get isStringLiteralType(): boolean { return this.kind === SymbolKind.StringLiteralType; }
  get isBooleanLiteralType(): boolean { return this.kind === SymbolKind.BooleanLiteralType; }
  get isNumberLiteralType(): boolean { return this.kind === SymbolKind.NumberLiteralType; }
  get isEnumLiteralType(): boolean { return this.kind === SymbolKind.EnumLiteralType; }
  get isProperty(): boolean { return this.kind === SymbolKind.Property; }
  get isMethod(): boolean { return this.kind === SymbolKind.Method; }
  get isSignature(): boolean { return this.kind === SymbolKind.Signature; }
  get isParameter(): boolean { return this.kind === SymbolKind.Parameter; }
  get isVariable(): boolean { return this.kind === SymbolKind.Variable; }
  get isTypeAlias(): boolean { return this.kind === SymbolKind.TypeAlias; }

  get isGenerationTarget(): boolean {
    return this.declarationInfos.every(d => {
      const resolvedPath = this.config.env.resolvePath(d.path);
      return resolvedPath !== this.config.env.defaultLibFileName &&
        _.includes(resolvedPath, this.config.typingDirectory);
    });
  }

  toString(): string {
    return this.name;
  }

  validate(): void {
  }

  /** @internal */
  destroy(ok: boolean = false): void {
    if (!ok || this.isDestroyed) { return; }
    Object.keys(this).forEach((key) => {
      delete (<any>this)[key];
    });
    this.isDestroyed = true;
  }
}

export class Type extends Symbol { }

export class Module extends Symbol {
  kind: SymbolKind = SymbolKind.Module;

  isNamespaceModule: boolean = false;
  importedModuleTable: ObjectTable<Module> = {};
  importedTypeTable: ObjectTable<Type> = {};
  modules: Module[] = [];
  types: Type[] = [];
  anonymousTypes: Type[] = [];
  variables: Variable[] = [];
  typeAliases: TypeAlias[] = [];

  get enums(): Enum[] { return <Enum[]>this.types.filter(t => t.isEnum); }
  get functions(): Function[] { return <Function[]>this.types.filter(t => t.isFunction); }
  get interfaces(): Interface[] { return <Interface[]>this.types.filter(t => t.isInterface); }
  get classes(): Class[] { return <Class[]>this.types.filter(t => t.isClass); }

  get isGlobalModule(): boolean { return this.rawName === '' && this.parentModule === null; }

  get name(): string {
    let name = this.isGlobalModule ? 'Global' : this.rawName;

    if (/^['"']/.test(name)) {
      name = name.replace(/['"]/g, '').replace('\\', '/');
      name = this.config.env.resolvePath(name);
      name = this.config.env.relativePath(this.config.typingDirectory, name);
    }
    return this.config.plugin.rename(this, name);
  }

  get importedModules(): { name: string; module: Module }[] {
    return _.map(this.importedModuleTable, (v, k) => { return { name: k || '', module: v }; });
  }

  get importedTypes(): { name: string; type: Type }[] {
    return _.map(this.importedTypeTable, (v, k) => { return { name: k || '', type: v }; });
  }

  /** @internal */
  initialize(isNamespaceModule: boolean,
      importedModuleTable: ObjectTable<Module>, importedTypeTable: ObjectTable<Type>,
      modules: Module[], types: Type[], variables: Variable[], typeAliases: TypeAlias[]): Module {
    this.isNamespaceModule = isNamespaceModule;
    this.importedModuleTable = importedModuleTable;
    this.importedTypeTable = importedTypeTable;
    this.modules = modules;
    this.types = types;
    this.variables = variables;
    this.typeAliases = typeAliases;
    return this;
  }
}

export class PrimitiveType extends Type {
  kind: SymbolKind = SymbolKind.PrimitiveType;
  get isGenerationTarget(): boolean { return true; }

  /** @internal */
  initialize(rawName: string): PrimitiveType {
    this.rawName = rawName;
    return this;
  }

  validate(): void | string {
    if (this.config.plugin.disallow.any && this.rawName === 'any') {
      return 'Disallow to define the any type';
    }
  }
}

export class Enum extends Type {
  kind: SymbolKind = SymbolKind.Enum;

  members: EnumMember[] = [];
  isConst: boolean = false;

  /** @internal */
  initialize(members: EnumMember[], isConst: boolean): Enum {
    this.members = members;
    this.isConst = isConst;
    return this;
  }
}

export class EnumMember extends Symbol {
  kind: SymbolKind = SymbolKind.EnumMember;

  value: number;

  /** @internal */
  initialize(value: number): EnumMember {
    this.value = value;
    return this;
  }
}

export class Function extends Type {
  kind: SymbolKind = SymbolKind.Function;

  callSignatures: Signature[] = [];

  /** @internal */
  initialize(callSignatures: Signature[]): Function {
    this.callSignatures = callSignatures;
    return this;
  }

  validate(): void | string {
    if (this.config.plugin.disallow.overload && this.callSignatures.length > 1) {
      return 'Disallow to use function overloading';
    } else if (this.config.plugin.disallow.anonymousFunction && this.isAnonymousType) {
      return 'Disallow to define an anonymous function';
    }
  }
}

export class ObjectLikeType extends Type {
  properties: Property[] = [];
  methods: Method[] = [];
  builtInSymbolMethods: Method[] = [];
  stringIndex: IndexInfo | null = null;
  numberIndex: IndexInfo | null = null;

  get ownProperties(): Property[] { return this.properties.filter(p => p.isOwn); }
  get ownMethods(): Method[] { return this.methods.filter(m => m.isOwn); }

  /** @internal */
  initialize(properties: Property[], methods: Method[], builtInSymbolMethods: Method[],
      stringIndex: IndexInfo | null, numberIndex: IndexInfo | null,
      ...forOverride: any[]): ObjectLikeType {
    this.properties = properties;
    this.methods = methods;
    this.builtInSymbolMethods = builtInSymbolMethods;
    this.stringIndex = stringIndex;
    this.numberIndex = numberIndex;
    return this;
  }

  validate(): void | string {
    if (this.config.plugin.disallow.anonymousObject && this.isAnonymousType) {
      return 'Disallow to define an anonymous object';
    }
  }
}

export class ObjectType extends ObjectLikeType {
  kind: SymbolKind = SymbolKind.ObjectType;

  templateType: Type | null;
  basedMappedType: ObjectType | null;

  get assumedName(): string {
    if (this.indexedAccessType == null) {
      return this.rawAssumedName;
    } else {
      return this.getAssumedNameFromIndexedAccessType(this.indexedAccessType);
    }
  }

  get indexedAccessType(): IndexedAccessType | null {
    if (this.templateType instanceof IndexedAccessType) {
      return this.templateType;
    } else if (this.templateType instanceof UnionType &&
        this.templateType.types.some(t => t.isIndexedAccessType)) {
      return this.templateType.types.filter(t => t.isIndexedAccessType)[0] as IndexedAccessType;
    } else {
      return null;
    }
  }

  get isMappedType(): boolean {
    return this.indexedAccessType != null && this.indexedAccessType.objectType.isTypeParameter;
  }

  static createEmptyObjectType(config: config.Config): ObjectType {
    const result = new ObjectType(config, '', [], [], [], null, 'Object');
    return result.initialize([], [], [], null, null, null, null);
  }

  /** @internal */
  initialize(properties: Property[], methods: Method[], builtInSymbolMethods: Method[],
      stringIndex: IndexInfo | null, numberIndex: IndexInfo | null,
      templateType: Type | null, basedMappedType: ObjectType | null,
      ...forOverride: any[]): ObjectType {
    super.initialize(properties, methods, builtInSymbolMethods, stringIndex, numberIndex);
    this.templateType = templateType;
    this.basedMappedType = basedMappedType;
    return this;
  }

  validate(): void | string {
    if (this.config.plugin.disallow.anonymousObject && this.isAnonymousType) {
      return 'Disallow to define an anonymous object';
    } else if (this.config.plugin.disallow.mappedType && this.templateType !== null) {
      return 'Disallow to define a mapped type';
    }
  }

  private getAssumedNameFromIndexedAccessType(indexedAccessType: IndexedAccessType) {
    if (indexedAccessType.objectType.isTypeParameter) {
      return this.rawAssumedName;
    } else {
      const objectTypeName = inflection.classify(indexedAccessType.objectType.name);
      return this.rawAssumedName + 'Of' + objectTypeName;
    }
  }
}

export class TypeReference {
  get typeArguments(): Type[] { return this.rawTypeArguments.filter(t => !t.isTypeParameter); }

  constructor(
      public typeParameters: TypeParameter[],
      private rawTypeArguments: Type[]) {
  }

  getTypeByTypeParameter(typeParameter: TypeParameter): Type | null {
    const index = this.typeParameters.indexOf(typeParameter);
    if (index < 0) { return null; }
    const type = this.rawTypeArguments[index];
    return type.isTypeParameter ? null : type;
  }
}

export class ClassOrInterface extends ObjectLikeType {
  constructorSignatures: Signature[] = [];
  callSignatures: Signature[] = [];
  baseTypes: Interface[] = [];
  typeReference: TypeReference;
  staticProperties: Property[] = [];
  staticMethods: Method[] = [];
  isAbstract: boolean = false;

  get isGenericType(): boolean { return this.typeParameters.length > 0; }
  get typeParameters(): Type[] { return this.typeReference.typeParameters; }
  get typeArguments(): Type[] { return this.typeReference.typeArguments; }

  get assumedName(): string {
    if (this.typeArguments.length === 0) { return ''; }

    return this.rawName + this.typeArguments.map((type, index) => {
      const prefix = index === 0 ? 'Of' : 'And';
      return prefix + inflection.classify(type.name);
    }).join('');
  }

  /** @internal */
  initialize(properties: Property[], methods: Method[], builtInSymbolMethods: Method[],
      stringIndex: IndexInfo | null, numberIndex: IndexInfo | null,
      typeReference: TypeReference, constructorSignatures: Signature[],
      callSignatures: Signature[], baseTypes: Interface[],
      staticProperties: Property[], staticMethods: Method[], isAbstract: boolean): Interface {
    super.initialize(properties, methods, builtInSymbolMethods, stringIndex, numberIndex);

    this.constructorSignatures = constructorSignatures;
    this.callSignatures = callSignatures;
    this.baseTypes = baseTypes;
    this.typeReference = typeReference;
    this.staticProperties = staticProperties;
    this.staticMethods = staticMethods;
    this.isAbstract = isAbstract;
    return this;
  }

  validate(): void | string {
    if (this.config.plugin.disallow.generics && this.isGenericType) {
      return 'Disallow to define a generic type';
    } else if (this.config.plugin.disallow.overload && (this.callSignatures.length > 1 || this.constructorSignatures.length > 1)) {
      return 'Disallow to use function overloading';
    }
  }
}

export class Interface extends ClassOrInterface {
  kind: SymbolKind = SymbolKind.Interface;
}

export class Class extends ClassOrInterface {
  kind: SymbolKind = SymbolKind.Class;
}

export class Array extends Type {
  kind: SymbolKind = SymbolKind.Array;
  type: Type;

  get isGenerationTarget(): boolean { return true; }

  get assumedName(): string {
    if (this.type === null) { return this.rawName; }
    return this.type.name + '[]';
  }

  /** @internal */
  initialize(type: Type): Array {
    this.type = type;
    return this;
  }
}

export class TypeParameter extends Type {
  kind: SymbolKind = SymbolKind.TypeParameter;

  constraint: Type | null;

  /** @internal */
  initialize(constraint: Type | null): TypeParameter {
    this.constraint = constraint;
    return this;
  }
}

export class Tuple extends Type {
  kind: SymbolKind = SymbolKind.Tuple;

  types: Type[] = [];

  get assumedName(): string {
    return this.types.map(t => inflection.classify(t.name)).join('And') + 'Tuple';
  }

  /** @internal */
  initialize(types: Type[]): Tuple {
    this.types = types;
    return this;
  }

  validate(): void | string {
    if (this.config.plugin.disallow.tuple) {
      return 'Disallow to define a tuple type';
    }
  }
}

export class UnionType extends Type {
  kind: SymbolKind = SymbolKind.UnionType;

  types: Type[] = [];

  get assumedName(): string {
    return this.types.map(t => inflection.classify(t.name)).join('And') + 'UnionType';
  }

  /** @internal */
  initialize(types: Type[]): UnionType {
    this.types = types;
    return this;
  }

  validate(): void | string {
    if (this.config.plugin.disallow.unionType) {
      return 'Disallow to define an union type';
    }
  }
}

export class IntersectionType extends Type {
  kind: SymbolKind = SymbolKind.IntersectionType;

  types: Type[] = [];

  get assumedName(): string {
    return this.types.map(t => inflection.classify(t.name)).join('And') + 'IntersectionType';
  }

  /** @internal */
  initialize(types: Type[]): UnionType {
    this.types = types;
    return this;
  }

  validate(): void | string {
    if (this.config.plugin.disallow.intersectionType) {
      return 'Disallow to define an intersection type';
    }
  }
}

export class IndexType extends Type {
  kind: SymbolKind = SymbolKind.IndexType;

  type: Type;

  get assumedName(): string {
    return 'Keyof' + this.type.name;
  }

  /** @internal */
  initialize(type: Type): IndexType {
    this.type = type;
    return this;
  }
}

export class IndexedAccessType extends Type {
  kind: SymbolKind = SymbolKind.IndexedAccessType;

  objectType: Type;
  indexType: Type;
  constraint: Type | null;

  get assumedName(): string {
    return this.objectType.name + '[' + this.indexType.name + ']';
  }

  /** @internal */
  initialize(objectType: Type, indexType: Type, constraint: Type | null): IndexedAccessType {
    this.objectType = objectType;
    this.indexType = indexType;
    this.constraint = constraint;
    return this;
  }
}

export class LiteralType extends Type {
  validate(): void | string {
    if (this.config.plugin.disallow.literalType) {
      return 'Disallow to define a literal type';
    }
  }
}

export class StringLiteralType extends LiteralType {
  kind: SymbolKind = SymbolKind.StringLiteralType;

  text: string = '';

  get rawText(): string {
    return this.text.replace(/"/g, '');
  }

  get assumedName(): string {
    return this.text;
  }

  /** @internal */
  initialize(text: string): StringLiteralType {
    this.text = '"' + text + '"';
    return this;
  }
}

export class BooleanLiteralType extends LiteralType {
  kind: SymbolKind = SymbolKind.BooleanLiteralType;

  value: boolean = false;

  get assumedName(): string {
    return this.value.toString();
  }

  /** @internal */
  initialize(value: boolean): BooleanLiteralType {
    this.value = value;
    return this;
  }
}

export class NumberLiteralType extends LiteralType {
  kind: SymbolKind = SymbolKind.NumberLiteralType;

  value: number = 0;

  get assumedName(): string {
    return this.value.toString();
  }

  /** @internal */
  initialize(value: number): NumberLiteralType {
    this.value = value;
    return this;
  }
}

export class EnumLiteralType extends LiteralType {
  kind: SymbolKind = SymbolKind.EnumLiteralType;

  enumType: Enum;
  enumMember: EnumMember;

  get assumedName(): string {
    return [this.enumType.name, this.enumMember.name].join(this.config.plugin.namespaceSeparator);
  }

  /** @internal */
  initialize(enumType: Enum, enumMember: EnumMember): EnumLiteralType {
    this.enumType = enumType;
    this.enumMember = enumMember;
    return this;
  }
}

export class Property extends Symbol {
  kind: SymbolKind = SymbolKind.Property;

  type: Type;
  isOptional: boolean = false;
  isOwn: boolean = false;
  isProtected: boolean = false;
  isReadonly: boolean = false;
  isAbstract: boolean = false;

  /** @internal */
  initialize(type: Type, isOptional: boolean, isOwn: boolean, isProtected: boolean, isReadonly: boolean, isAbstract: boolean): Property {
    this.type = type;
    this.isOptional = isOptional;
    this.isOwn = isOwn;
    this.isProtected = isProtected;
    this.isReadonly = isReadonly;
    this.isAbstract = isAbstract;
    return this;
  }
}

export class Method extends Symbol {
  kind: SymbolKind = SymbolKind.Method;

  callSignatures: Signature[] = [];
  isOptional: boolean = false;
  isOwn: boolean = false;
  isAbstract: boolean = false;

  /** @internal */
  initialize(callSignatures: Signature[], isOptional: boolean, isOwn: boolean, isAbstract: boolean): Method {
    this.callSignatures = callSignatures;
    this.isOptional = isOptional;
    this.isOwn = isOwn;
    this.isAbstract = isAbstract;
    return this;
  }

  validate(): void | string {
    if (this.config.plugin.disallow.overload && this.callSignatures.length > 1) {
      return 'Disallow to use function overloading';
    }
  }
}

export class Signature extends Symbol {
  kind: SymbolKind = SymbolKind.Signature;

  typeParameters: TypeParameter[] = [];
  parameters: Parameter[] = [];
  returnType: Type;
  typePredicate: TypePredicate | null;
  isProtected: boolean = false;

  get isGenericSignature(): boolean { return this.typeParameters.length > 0; }

  /** @internal */
  initialize(typeParameters: TypeParameter[], parameters: Parameter[],
      returnType: Type, typePredicate: TypePredicate | null, isProtected: boolean): Signature {
    this.typeParameters = typeParameters;
    this.parameters = parameters;
    this.returnType = returnType;
    this.typePredicate = typePredicate;
    this.isProtected = isProtected;
    return this;
  }

  validate(): void | string {
    if (this.config.plugin.disallow.generics && this.typeParameters.length > 0) {
      return 'Disallow to define a generic function';
    }
  }
}

export class Parameter extends Symbol {
  kind: SymbolKind = SymbolKind.Parameter;

  type: Type;
  isOptional: boolean = false;
  isVariadic: boolean = false;

  /** @internal */
  initialize(type: Type, isOptional: boolean, isVariadic: boolean): Parameter {
    this.type = type;
    this.isOptional = isOptional;
    this.isVariadic = isVariadic;
    return this;
  }
}

export class Variable extends Symbol {
  kind: SymbolKind = SymbolKind.Variable;

  type: Type | null;
  module: Module | null;
  isLet: boolean = false;
  isConst: boolean = false;

  /** @internal */
  initialize(type: Type | null, module: Module | null, isLet: boolean, isConst: boolean): Variable {
    this.type = type;
    this.module = module;
    this.isLet = isLet;
    this.isConst = isConst;
    return this;
  }
}

export class TypeAlias extends Symbol {
  kind: SymbolKind = SymbolKind.TypeAlias;

  type: Type;

  /** @internal */
  initialize(type: Type): TypeAlias {
    this.type = type;
    return this;
  }
}
