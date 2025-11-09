// ============================================================================
// AST - Abstract Syntax Tree Node Types
// ============================================================================

export type ASTNode = 
  | ProgramNode
  | VariableDeclarationNode
  | FunctionDeclarationNode
  | ReturnStatementNode
  | IfStatementNode
  | ForStatementNode
  | ExpressionStatementNode
  | BinaryExpressionNode
  | UnaryExpressionNode
  | CallExpressionNode
  | MemberExpressionNode
  | ArrayExpressionNode
  | ObjectExpressionNode
  | IdentifierNode
  | LiteralNode
  | ConditionalExpressionNode
  | ArrowFunctionNode
  | AssignmentExpressionNode;

export interface BaseNode {
  type: string;
}

export interface ProgramNode extends BaseNode {
  type: 'Program';
  body: ASTNode[];
}

export interface VariableDeclarationNode extends BaseNode {
  type: 'VariableDeclaration';
  identifier: string;
  value: ASTNode;
  constant: boolean;
}

export interface FunctionDeclarationNode extends BaseNode {
  type: 'FunctionDeclaration';
  name: string;
  params: string[];
  body: ASTNode[];
}

export interface ReturnStatementNode extends BaseNode {
  type: 'ReturnStatement';
  value: ASTNode | null;
}

export interface IfStatementNode extends BaseNode {
  type: 'IfStatement';
  condition: ASTNode;
  consequent: ASTNode[];
  alternate: ASTNode[] | null;
}

export interface ForStatementNode extends BaseNode {
  type: 'ForStatement';
  variable: string;
  iterable: ASTNode;
  body: ASTNode[];
}

export interface ExpressionStatementNode extends BaseNode {
  type: 'ExpressionStatement';
  expression: ASTNode;
}

export interface BinaryExpressionNode extends BaseNode {
  type: 'BinaryExpression';
  operator: string;
  left: ASTNode;
  right: ASTNode;
}

export interface UnaryExpressionNode extends BaseNode {
  type: 'UnaryExpression';
  operator: string;
  operand: ASTNode;
}

export interface CallExpressionNode extends BaseNode {
  type: 'CallExpression';
  callee: ASTNode;
  arguments: ASTNode[];
}

export interface MemberExpressionNode extends BaseNode {
  type: 'MemberExpression';
  object: ASTNode;
  property: string;
  computed: boolean;
}

export interface ArrayExpressionNode extends BaseNode {
  type: 'ArrayExpression';
  elements: ASTNode[];
}

export interface ObjectExpressionNode extends BaseNode {
  type: 'ObjectExpression';
  properties: { key: string; value: ASTNode }[];
}

export interface IdentifierNode extends BaseNode {
  type: 'Identifier';
  name: string;
}

export interface LiteralNode extends BaseNode {
  type: 'Literal';
  value: number | string | boolean | null;
}

export interface ConditionalExpressionNode extends BaseNode {
  type: 'ConditionalExpression';
  test: ASTNode;
  consequent: ASTNode;
  alternate: ASTNode;
}

export interface ArrowFunctionNode extends BaseNode {
  type: 'ArrowFunction';
  params: string[];
  body: ASTNode;
}

export interface AssignmentExpressionNode extends BaseNode {
  type: 'AssignmentExpression';
  target: ASTNode;
  value: ASTNode;
}

// ============================================================================
// TYPE SYSTEM
// ============================================================================

export interface Type {
  kind: 'primitive' | 'array' | 'object' | 'function' | 'union' | 'unknown';
  name?: string;
  elementType?: Type;
  properties?: Record<string, Type>;
  parameters?: Type[];
  returnType?: Type;
  types?: Type[]; // for union types
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

export default class TypeChecker {
  private symbolTable = new Map<string, Type>();
  private customTypes = new Map<string, Type>();
  
  constructor(contextTypes?: Record<string, Type>) {
    if (contextTypes) {
      for (const [name, type] of Object.entries(contextTypes)) {
        this.symbolTable.set(name, type);
      }
    }
  }
  
  registerType(name: string, type: Type) {
    this.customTypes.set(name, type);
  }
  
  check(ast: ProgramNode): Type {
    let lastType: Type = BUILTIN_TYPES.unknown;
    
    // Process all statements in order to build symbol table
    for (const statement of ast.body) {
      lastType = this.checkStatement(statement);
    }
    
    return lastType;
  }
  
  inferReturnType(ast: ProgramNode): Type {
    // First pass: collect all variable declarations to build symbol table
    for (const statement of ast.body) {
      if (statement.type === 'VariableDeclaration') {
        const valueType = this.inferExpression(statement.value);
        this.symbolTable.set(statement.identifier, valueType);
      }
    }
    
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
        } else if (node.type === 'FunctionDeclaration') {
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
  
  private checkVariableDeclaration(node: VariableDeclarationNode): Type {
    const valueType = this.inferExpression(node.value);
    this.symbolTable.set(node.identifier, valueType);
    return valueType;
  }
  
  private checkFunctionDeclaration(node: FunctionDeclarationNode): Type {
    // Create new scope for function
    const savedSymbols = new Map(this.symbolTable);
    
    // Add parameters to scope (unknown type for now)
    for (const param of node.params) {
      this.symbolTable.set(param, BUILTIN_TYPES.unknown);
    }
    
    // Infer return type from function body
    const returnTypes: Type[] = [];
    for (const stmt of node.body) {
      if (stmt.type === 'ReturnStatement' && stmt.value) {
        returnTypes.push(this.inferExpression(stmt.value));
      }
    }
    
    const returnType = returnTypes.length > 0 
      ? (returnTypes.length === 1 ? returnTypes[0] : { kind: 'union' as const, types: returnTypes })
      : BUILTIN_TYPES.unknown;
    
    // Restore scope
    this.symbolTable = savedSymbols;
    
    const funcType: Type = {
      kind: 'function',
      parameters: node.params.map(() => BUILTIN_TYPES.unknown),
      returnType,
    };
    
    this.symbolTable.set(node.name, funcType);
    return funcType;
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
    if (iterableType.kind === 'array' && iterableType.elementType) {
      itemType = iterableType.elementType;
    }
    
    // Add loop variable to symbol table
    this.symbolTable.set(node.variable, itemType);
    
    let lastType: Type = BUILTIN_TYPES.unknown;
    for (const stmt of node.body) {
      lastType = this.checkStatement(stmt);
    }
    
    // Restore symbol table but keep any variables declared inside the loop
    // that might be used after (this is a simplification)
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
  
  private inferLiteral(node: LiteralNode): Type {
    if (typeof node.value === 'number') return BUILTIN_TYPES.number;
    if (typeof node.value === 'string') return BUILTIN_TYPES.string;
    if (typeof node.value === 'boolean') return BUILTIN_TYPES.boolean;
    if (node.value === null) return BUILTIN_TYPES.null;
    return BUILTIN_TYPES.unknown;
  }
  
  private inferIdentifier(node: IdentifierNode): Type {
    return this.symbolTable.get(node.name) || BUILTIN_TYPES.unknown;
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
      const method = node.callee.property;
      
      if (objectType.kind === 'array' && objectType.elementType) {
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
    
    if (objectType.kind === 'object' && objectType.properties) {
      return objectType.properties[node.property] || BUILTIN_TYPES.unknown;
    }
    
    // Handle array.length
    if (objectType.kind === 'array' && node.property === 'length') {
      return BUILTIN_TYPES.number;
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
    
    for (const param of node.params) {
      this.symbolTable.set(param, BUILTIN_TYPES.unknown);
    }
    
    const returnType = this.inferExpression(node.body);
    
    this.symbolTable = savedSymbols;
    
    return {
      kind: 'function',
      parameters: node.params.map(() => BUILTIN_TYPES.unknown),
      returnType,
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
    return false;
  }
  
  typeToString(type: Type): string {
    switch (type.kind) {
      case 'primitive':
        return type.name || 'unknown';
      case 'array':
        return `${this.typeToString(type.elementType!)}[]`;
      case 'object':
        if (type.name) return type.name;
        const props = Object.entries(type.properties || {})
          .map(([key, val]) => `${key}: ${this.typeToString(val)}`)
          .join(', ');
        return `{ ${props} }`;
      case 'function':
        const params = (type.parameters || []).map(p => this.typeToString(p)).join(', ');
        return `(${params}) => ${this.typeToString(type.returnType!)}`;
      case 'union':
        return (type.types || []).map(t => this.typeToString(t)).join(' | ');
      case 'unknown':
        return 'unknown';
      default:
        return 'unknown';
    }
  }
}