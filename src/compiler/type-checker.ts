// ============================================================================
// TYPE SYSTEM with Async/Await Support
// ============================================================================

import { ProgramNode, ASTNode, VariableDeclarationNode, FunctionDeclarationNode, IfStatementNode, ForStatementNode, LiteralNode, IdentifierNode, BinaryExpressionNode, UnaryExpressionNode, CallExpressionNode, MemberExpressionNode, ArrayExpressionNode, ObjectExpressionNode, ConditionalExpressionNode, ArrowFunctionNode, InterfaceDeclarationNode, TypeAnnotation, TypeDeclarationNode, AwaitExpressionNode } from "./ast";

export interface Type {
  kind: 'primitive' | 'array' | 'object' | 'function' | 'union' | 'promise' | 'unknown';
  name?: string;
  elementType?: Type;
  properties?: Record<string, Type>;
  parameters?: Type[];
  returnType?: Type;
  types?: Type[]; // for union types
  resolveType?: Type; // for promise types
  async?: boolean; // for function types
}

export const BUILTIN_TYPES = {
  number: { kind: 'primitive' as const, name: 'number' },
  string: { kind: 'primitive' as const, name: 'string' },
  boolean: { kind: 'primitive' as const, name: 'boolean' },
  null: { kind: 'primitive' as const, name: 'null' },
  unknown: { kind: 'unknown' as const },
};

// ============================================================================
// TYPE CHECKER with Inference
// ============================================================================

export class TypeChecker {
  private symbolTable = new Map<string, Type>();
  private customTypes = new Map<string, Type>();
  private currentFunctionIsAsync = false; // Track if we're in an async function
  private allowTopLevelAwait = true; // whether top-level await is allowed (generated code runs in async wrapper)
  
  constructor(contextTypes?: Record<string, Type>, options?: { allowTopLevelAwait?: boolean }) {
    if (contextTypes) {
      for (const [name, type] of Object.entries(contextTypes)) {
        this.symbolTable.set(name, type);
      }
    }

    if (options && typeof options.allowTopLevelAwait === 'boolean') {
      this.allowTopLevelAwait = options.allowTopLevelAwait;
    }
  }
  
  registerType(name: string, type: Type) {
    this.customTypes.set(name, type);
  }

  registerFunction(name: string, params: Type[], returnType: Type, isAsync: boolean = false) {
    const funcType: Type = {
      kind: 'function',
      parameters: params,
      returnType,
      async: isAsync,
    };
    
    this.symbolTable.set(name, funcType);
  }
  
  check(ast: ProgramNode): Type {
    let lastType: Type = BUILTIN_TYPES.unknown;
    // When checking a top-level program, treat top-level as async when allowed so `await` is permitted
    const savedAsync = this.currentFunctionIsAsync;
    this.currentFunctionIsAsync = this.allowTopLevelAwait;

    try {
      // Process all statements in order to build symbol table
      for (const statement of ast.body) {
        lastType = this.checkStatement(statement);
      }
    } finally {
      this.currentFunctionIsAsync = savedAsync;
    }

    return lastType;
  }
  
  inferReturnType(ast: ProgramNode): Type {
    // This will populate the symbol table with all variables and functions
    this.check(ast)
    
    const returnTypes: Type[] = [];
    
    const collectReturns = (nodes: ASTNode[]) => {
      for (const node of nodes) {
        if (node.type === 'ReturnStatement') {
          if (node.value) {
            returnTypes.push(this.inferExpression(node.value));
          }
        } else if (node.type === 'IfStatement') {
          collectReturns(node.consequent);
          if (node.alternate) collectReturns(node.alternate);
        } else if (node.type === 'ForStatement') {
          collectReturns(node.body);
        }
      }
    };
    
    collectReturns(ast.body);
    
    if (returnTypes.length === 0) {
      return BUILTIN_TYPES.unknown;
    }
    
    if (returnTypes.length === 1) {
      return returnTypes[0];
    }
    
    // Multiple return types - create union
    return { kind: 'union', types: returnTypes };
  }
  
  private checkStatement(node: ASTNode): Type {
    switch (node.type) {
      case 'TypeDeclaration':
        return this.checkTypeDeclaration(node);
      case 'InterfaceDeclaration':
        return this.checkInterfaceDeclaration(node);
      case 'VariableDeclaration':
        return this.checkVariableDeclaration(node);
      case 'FunctionDeclaration':
        return this.checkFunctionDeclaration(node);
      case 'ReturnStatement':
        return node.value ? this.inferExpression(node.value) : BUILTIN_TYPES.unknown;
      case 'IfStatement':
        return this.checkIfStatement(node);
      case 'ForStatement':
        return this.checkForStatement(node);
      case 'ExpressionStatement':
        return this.inferExpression(node.expression);
      default:
        return BUILTIN_TYPES.unknown;
    }
  }
  
  private checkTypeDeclaration(node: TypeDeclarationNode): Type {
    const type = this.annotationToType(node.typeAnnotation);
    this.customTypes.set(node.name, type);
    return type;
  }
  
  private checkInterfaceDeclaration(node: InterfaceDeclarationNode): Type {
    const properties: Record<string, Type> = {};
    
    for (const prop of node.properties) {
      properties[prop.key] = this.annotationToType(prop.typeAnnotation);
    }
    
    const type: Type = { kind: 'object', name: node.name, properties };
    this.customTypes.set(node.name, type);
    return type;
  }
  
  private annotationToType(annotation: TypeAnnotation): Type {
    switch (annotation.type) {
      case 'PrimitiveType':
        return BUILTIN_TYPES[annotation.name];
      
      case 'ArrayType':
        return {
          kind: 'array',
          elementType: this.annotationToType(annotation.elementType)
        };
      
      case 'ObjectType':
        const properties: Record<string, Type> = {};
        for (const prop of annotation.properties) {
          properties[prop.key] = this.annotationToType(prop.valueType);
        }
        return { kind: 'object', properties };
      
      case 'UnionType':
        return {
          kind: 'union',
          types: annotation.types.map(t => this.annotationToType(t))
        };
      
      case 'TypeReference':
        return this.customTypes.get(annotation.name) || BUILTIN_TYPES.unknown;
      
      case 'PromiseType':
        return {
          kind: 'promise',
          resolveType: this.annotationToType(annotation.resolveType)
        };
      
      default:
        return BUILTIN_TYPES.unknown;
    }
  }
  
  private checkVariableDeclaration(node: VariableDeclarationNode): Type {
    const valueType = this.inferExpression(node.value);
    
    // If type annotation exists, check compatibility
    if (node.typeAnnotation) {
      const declaredType = this.annotationToType(node.typeAnnotation);
      if (!this.isAssignable(valueType, declaredType)) {
        throw new TypeError(
          `Cannot assign ${this.typeToString(valueType)} to ${this.typeToString(declaredType)}`
        );
      }
      this.symbolTable.set(node.identifier, declaredType);
      return declaredType;
    }
    
    this.symbolTable.set(node.identifier, valueType);
    return valueType;
  }
  
  private checkFunctionDeclaration(node: FunctionDeclarationNode): Type {
    // Create new scope for function
    const savedSymbols = new Map(this.symbolTable);
    const savedAsync = this.currentFunctionIsAsync;
    this.currentFunctionIsAsync = node.async;
    
    // Add parameters to scope with their types
    const paramTypes: Type[] = [];
    for (const param of node.params) {
      const paramType = param.typeAnnotation 
        ? this.annotationToType(param.typeAnnotation)
        : BUILTIN_TYPES.unknown;
      
      this.symbolTable.set(param.name, paramType);
      paramTypes.push(paramType);
    }
    
    // Infer return type from function body
    const returnTypes: Type[] = [];
    for (const stmt of node.body) {
      if (stmt.type === 'ReturnStatement' && stmt.value) {
        returnTypes.push(this.inferExpression(stmt.value));
      }
    }
    
    const inferredReturnType = returnTypes.length > 0 
      ? (returnTypes.length === 1 ? returnTypes[0] : { kind: 'union' as const, types: returnTypes })
      : BUILTIN_TYPES.unknown;
    
    // If async function, wrap return type in Promise
    let returnType = node.async && inferredReturnType.kind !== 'promise'
      ? { kind: 'promise' as const, resolveType: inferredReturnType }
      : inferredReturnType;
    
    // If return type annotation exists, check compatibility
    if (node.returnTypeAnnotation) {
      const declaredReturnType = this.annotationToType(node.returnTypeAnnotation);
      if (!this.isAssignable(returnType, declaredReturnType)) {
        throw new TypeError(
          `Function ${node.name} returns ${this.typeToString(returnType)} but declared ${this.typeToString(declaredReturnType)}`
        );
      }
      returnType = declaredReturnType;
    }
    
    // Restore scope
    this.symbolTable = savedSymbols;
    this.currentFunctionIsAsync = savedAsync;
    
    const funcType: Type = {
      kind: 'function',
      parameters: paramTypes,
      returnType,
      async: node.async,
    };
    
    this.symbolTable.set(node.name, funcType);
    return funcType;
  }
  
  private isAssignable(source: Type, target: Type): boolean {
    // If source is a union, it's assignable to target only if every
    // member of the union is assignable to the target.
    if (source.kind === 'union') {
      // TODO: ignore null in this
      // Spell should be assignable to Spell | null for example
      return source.types!.every(s => this.isAssignable(s, target));
    }

    // Same type
    if (this.typesEqual(source, target)) {
      return true;
    }
    
    // Unknown is assignable to anything
    if (source.kind === 'unknown' || target.kind === 'unknown') {
      return true;
    }
    
    // Union type checking
    if (target.kind === 'union') {
      return target.types!.some(t => this.isAssignable(source, t));
    }
    
    // Array covariance
    if (source.kind === 'array' && target.kind === 'array') {
      return this.isAssignable(source.elementType!, target.elementType!);
    }
    
    // Promise covariance
    if (source.kind === 'promise' && target.kind === 'promise') {
      return this.isAssignable(source.resolveType!, target.resolveType!);
    }
    
    // Structural typing for objects
    if (target.kind === 'object' && source.kind === 'object') {
      for (const [key, targetProp] of Object.entries(target.properties || {})) {
        const sourceProp = source.properties?.[key];
        if (!sourceProp || !this.isAssignable(sourceProp, targetProp)) {
          return false;
        }
      }
      return true;
    }
    
    return false;
  }
  
  private checkIfStatement(node: IfStatementNode): Type {
    this.inferExpression(node.condition);
    
    const types: Type[] = [];
    for (const stmt of node.consequent) {
      types.push(this.checkStatement(stmt));
    }
    
    if (node.alternate) {
      for (const stmt of node.alternate) {
        types.push(this.checkStatement(stmt));
      }
    }
    
    return types.length > 0 ? types[types.length - 1] : BUILTIN_TYPES.unknown;
  }
  
  private checkForStatement(node: ForStatementNode): Type {
    const savedSymbols = new Map(this.symbolTable);
    
    const iterableType = this.inferExpression(node.iterable);
    
    // Infer item type from iterable
    let itemType: Type = BUILTIN_TYPES.unknown;
    
    // For await...of, unwrap promise of array
    if (node.async && iterableType.kind === 'promise' && iterableType.resolveType?.kind === 'array') {
      if (!this.currentFunctionIsAsync) {
        throw new TypeError('await can only be used in async functions');
      }
      itemType = iterableType.resolveType.elementType!;
    } else if (iterableType.kind === 'array' && iterableType.elementType) {
      itemType = iterableType.elementType;
    } else if (node.async) {
      throw new TypeError('for await...of requires an async iterable (Promise<T[]>)');
    }
    
    // Add loop variable to symbol table
    this.symbolTable.set(node.variable, itemType);
    
    let lastType: Type = BUILTIN_TYPES.unknown;
    for (const stmt of node.body) {
      lastType = this.checkStatement(stmt);
    }
    
    // Restore symbol table
    this.symbolTable = savedSymbols;
    return lastType;
  }
  
  inferExpression(node: ASTNode): Type {
    switch (node.type) {
      case 'Literal':
        return this.inferLiteral(node);
      case 'Identifier':
        return this.inferIdentifier(node);
      case 'BinaryExpression':
        return this.inferBinaryExpression(node);
      case 'UnaryExpression':
        return this.inferUnaryExpression(node);
      case 'CallExpression':
        return this.inferCallExpression(node);
      case 'MemberExpression':
        return this.inferMemberExpression(node);
      case 'ArrayExpression':
        return this.inferArrayExpression(node);
      case 'ObjectExpression':
        return this.inferObjectExpression(node);
      case 'ConditionalExpression':
        return this.inferConditionalExpression(node);
      case 'ArrowFunction':
        return this.inferArrowFunction(node);
      case 'AwaitExpression':
        return this.inferAwaitExpression(node);
      case 'AssignmentExpression':
        // For assignments, update symbol table and return the value type
        const valueType = this.inferExpression(node.value);
        if (node.target.type === 'Identifier') {
          this.symbolTable.set(node.target.name, valueType);
        }
        return valueType;
      default:
        return BUILTIN_TYPES.unknown;
    }
  }
  
  private inferAwaitExpression(node: AwaitExpressionNode): Type {
    if (!this.currentFunctionIsAsync) {
      throw new TypeError('await can only be used in async functions');
    }
    
    const argType = this.inferExpression(node.argument);
    
    // If it's a promise, unwrap it
    if (argType.kind === 'promise' && argType.resolveType) {
      return argType.resolveType;
    }
    
    // If it's not a promise, await still returns the value
    return argType;
  }
  
  private inferLiteral(node: LiteralNode): Type {
    if (typeof node.value === 'number') return BUILTIN_TYPES.number;
    if (typeof node.value === 'string') return BUILTIN_TYPES.string;
    if (typeof node.value === 'boolean') return BUILTIN_TYPES.boolean;
    if (node.value === null) return BUILTIN_TYPES.null;
    return BUILTIN_TYPES.unknown;
  }
  
  private inferIdentifier(node: IdentifierNode): Type {
    let type = this.symbolTable.get(node.name)

    if (!type || type.kind === 'unknown') type = this.customTypes.get(node.name)
    if (!type) type = BUILTIN_TYPES.unknown

    return type
  }
  
  private inferBinaryExpression(node: BinaryExpressionNode): Type {
    const left = this.inferExpression(node.left);
    const right = this.inferExpression(node.right);
    
    // Arithmetic operators
    if (['+', '-', '*', '/', '%'].includes(node.operator)) {
      if (node.operator === '+') {
        // String concatenation
        if (left.kind === 'primitive' && left.name === 'string') return BUILTIN_TYPES.string;
        if (right.kind === 'primitive' && right.name === 'string') return BUILTIN_TYPES.string;
      }
      return BUILTIN_TYPES.number;
    }
    
    // Comparison operators
    if (['==', '!=', '<', '<=', '>', '>='].includes(node.operator)) {
      return BUILTIN_TYPES.boolean;
    }
    
    // Logical operators
    if (['&&', '||'].includes(node.operator)) {
      return BUILTIN_TYPES.boolean;
    }
    
    return BUILTIN_TYPES.unknown;
  }
  
  private inferUnaryExpression(node: UnaryExpressionNode): Type {
    const operand = this.inferExpression(node.operand);
    
    if (node.operator === '!') return BUILTIN_TYPES.boolean;
    if (node.operator === '-') return BUILTIN_TYPES.number;
    
    return operand;
  }
  
  private inferCallExpression(node: CallExpressionNode): Type {
    const calleeType = this.inferExpression(node.callee);
    
    // Check for built-in array methods
    if (node.callee.type === 'MemberExpression') {
      const objectType = this.inferExpression(node.callee.object);
      // property may be a string or an ASTNode for computed access
      let method: string | null = null;
      if (typeof node.callee.property === 'string') {
        method = node.callee.property;
      } else if (node.callee.property.type === 'Literal' && typeof (node.callee.property as LiteralNode).value === 'string') {
        method = (node.callee.property as LiteralNode).value as string;
      }
      
  if (method && objectType.kind === 'array' && objectType.elementType) {
        // Array methods that return same type array
  if (['filter', 'map', 'slice', 'concat'].includes(method)) {
          if (method === 'map' && node.arguments.length > 0) {
            // For map, we'd need to infer the callback return type
            // For simplicity, keep the same element type
            return objectType;
          }
          return objectType;
        }
        
        // Array methods that return single element
        if (['find', 'at'].includes(method)) {
          return objectType.elementType;
        }
        
        // Array methods that return number
        if (['length', 'findIndex', 'indexOf'].includes(method)) {
          return BUILTIN_TYPES.number;
        }
        
        // Array methods that return boolean
        if (['some', 'every', 'includes'].includes(method)) {
          return BUILTIN_TYPES.boolean;
        }
      }
    }
    
    if (calleeType.kind === 'function' && calleeType.returnType) {
      return calleeType.returnType;
    }
    
    return BUILTIN_TYPES.unknown;
  }
  
  private inferMemberExpression(node: MemberExpressionNode): Type {
    const objectType = this.inferExpression(node.object);

    // Non-computed property: property should be a string
    if (!node.computed) {
      if (objectType.kind === 'object' && objectType.properties) {
        return objectType.properties[(node.property as string)] || BUILTIN_TYPES.unknown;
      }

      if (objectType.kind === 'array' && (node.property as string) === 'length') {
        return BUILTIN_TYPES.number;
      }

      return BUILTIN_TYPES.unknown;
    }

    // Computed property: property may be a string (from a literal) or an ASTNode
    let resolvedProp: string | number | null = null;

    if (typeof node.property === 'string') {
      // If it's a numeric string, treat as index
      if (/^-?\d+$/.test(node.property)) {
        resolvedProp = Number(node.property);
      } else {
        resolvedProp = node.property;
      }
    } else {
      // property is an AST node; if it's a literal we can extract value
      if (node.property.type === 'Literal') {
        const v = (node.property as LiteralNode).value;
        if (typeof v === 'number' || typeof v === 'string') resolvedProp = v;
      }
    }

    // If we resolved a string property and object is object-like
    if (resolvedProp !== null && typeof resolvedProp === 'string') {
      if (objectType.kind === 'object' && objectType.properties) {
        return objectType.properties[resolvedProp] || BUILTIN_TYPES.unknown;
      }
      if (objectType.kind === 'array' && resolvedProp === 'length') {
        return BUILTIN_TYPES.number;
      }
    }

    // If we resolved a numeric index and object is array
    if (resolvedProp !== null && typeof resolvedProp === 'number') {
      if (objectType.kind === 'array' && objectType.elementType) {
        return objectType.elementType;
      }
    }

    return BUILTIN_TYPES.unknown;
  }
  
  private inferArrayExpression(node: ArrayExpressionNode): Type {
    if (node.elements.length === 0) {
      return { kind: 'array', elementType: BUILTIN_TYPES.unknown };
    }
    
    // Infer element type from first element
    const elementType = this.inferExpression(node.elements[0]);
    return { kind: 'array', elementType };
  }
  
  private inferObjectExpression(node: ObjectExpressionNode): Type {
    const properties: Record<string, Type> = {};
    
    for (const prop of node.properties) {
      properties[prop.key] = this.inferExpression(prop.value);
    }
    
    return { kind: 'object', properties };
  }
  
  private inferConditionalExpression(node: ConditionalExpressionNode): Type {
    const consequent = this.inferExpression(node.consequent);
    const alternate = this.inferExpression(node.alternate);
    
    // If both branches return same type, return that type
    if (this.typesEqual(consequent, alternate)) {
      return consequent;
    }
    
    // Otherwise return union
    return { kind: 'union', types: [consequent, alternate] };
  }
  
  private inferArrowFunction(node: ArrowFunctionNode): Type {
    const savedSymbols = new Map(this.symbolTable);
    const savedAsync = this.currentFunctionIsAsync;
    this.currentFunctionIsAsync = node.async;
    
    for (const param of node.params) {
      this.symbolTable.set(param, BUILTIN_TYPES.unknown);
    }
    
    let returnType = this.inferExpression(node.body);
    
    // If async arrow function and return type is not a promise, wrap it
    if (node.async && returnType.kind !== 'promise') {
      returnType = { kind: 'promise', resolveType: returnType };
    }
    
    this.symbolTable = savedSymbols;
    this.currentFunctionIsAsync = savedAsync;
    
    return {
      kind: 'function',
      parameters: node.params.map(() => BUILTIN_TYPES.unknown),
      returnType,
      async: node.async,
    };
  }
  
  private typesEqual(a: Type, b: Type): boolean {
    if (a.kind !== b.kind) return false;
    if (a.kind === 'primitive' && b.kind === 'primitive') {
      return a.name === b.name;
    }
    if (a.kind === 'array' && b.kind === 'array') {
      return this.typesEqual(a.elementType!, b.elementType!);
    }
    if (a.kind === 'promise' && b.kind === 'promise') {
      return this.typesEqual(a.resolveType!, b.resolveType!);
    }
    return false;
  }
  
  typeToString(type: Type): string {
    switch (type.kind) {
      case 'primitive':
        return type.name || 'unknown';
      case 'array':
        return `${this.typeToString(type.elementType!)}[]`;
      case 'promise':
        return `Promise<${this.typeToString(type.resolveType!)}>`;
      case 'object':
        if (type.name) return type.name;
        const props = Object.entries(type.properties || {})
          .map(([key, val]) => `${key}: ${this.typeToString(val)}`)
          .join(', ');
        return `{ ${props} }`;
      case 'function':
        const params = (type.parameters || []).map(p => this.typeToString(p)).join(', ');
        const asyncPrefix = type.async ? 'async ' : '';
        return `${asyncPrefix}(${params}) => ${this.typeToString(type.returnType!)}`;
      case 'union':
        return (type.types || []).map(t => this.typeToString(t)).join(' | ');
      case 'unknown':
        return 'unknown';
      default:
        return 'unknown';
    }
  }
}