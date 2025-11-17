// ============================================================================
// AST Node Type Definitions - Complete
// ============================================================================

// Base node interface
export interface BaseNode {
  type: string;
}

// All possible AST node types
export type ASTNode = 
  | ProgramNode
  | TypeDeclarationNode
  | InterfaceDeclarationNode
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
  | AssignmentExpressionNode
  | AwaitExpressionNode;

// ============================================================================
// Statement Nodes
// ============================================================================

export interface ProgramNode extends BaseNode {
  type: 'Program';
  body: ASTNode[];
}

export interface TypeDeclarationNode extends BaseNode {
  type: 'TypeDeclaration';
  name: string;
  typeAnnotation: TypeAnnotation;
}

export interface InterfaceDeclarationNode extends BaseNode {
  type: 'InterfaceDeclaration';
  name: string;
  properties: { key: string; typeAnnotation: TypeAnnotation }[];
}

export interface VariableDeclarationNode extends BaseNode {
  type: 'VariableDeclaration';
  identifier: string;
  value: ASTNode;
  constant: boolean;
  typeAnnotation?: TypeAnnotation;
}

export interface FunctionDeclarationNode extends BaseNode {
  type: 'FunctionDeclaration';
  name: string;
  params: { name: string; typeAnnotation?: TypeAnnotation }[];
  returnTypeAnnotation?: TypeAnnotation;
  body: ASTNode[];
  async: boolean;
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
  async: boolean;
}

export interface ExpressionStatementNode extends BaseNode {
  type: 'ExpressionStatement';
  expression: ASTNode;
}

// ============================================================================
// Expression Nodes
// ============================================================================

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
  async: boolean;
}

export interface AssignmentExpressionNode extends BaseNode {
  type: 'AssignmentExpression';
  target: ASTNode;
  value: ASTNode;
}

export interface AwaitExpressionNode extends BaseNode {
  type: 'AwaitExpression';
  argument: ASTNode;
}

// ============================================================================
// Type Annotation Nodes
// ============================================================================

export type TypeAnnotation =
  | PrimitiveTypeAnnotation
  | ArrayTypeAnnotation
  | ObjectTypeAnnotation
  | UnionTypeAnnotation
  | TypeReferenceAnnotation
  | PromiseTypeAnnotation;

export interface PrimitiveTypeAnnotation {
  type: 'PrimitiveType';
  name: 'number' | 'string' | 'boolean' | 'null';
}

export interface ArrayTypeAnnotation {
  type: 'ArrayType';
  elementType: TypeAnnotation;
}

export interface ObjectTypeAnnotation {
  type: 'ObjectType';
  properties: { key: string; valueType: TypeAnnotation }[];
}

export interface UnionTypeAnnotation {
  type: 'UnionType';
  types: TypeAnnotation[];
}

export interface TypeReferenceAnnotation {
  type: 'TypeReference';
  name: string;
}

export interface PromiseTypeAnnotation {
  type: 'PromiseType';
  resolveType: TypeAnnotation;
}

// ============================================================================
// Type Guards (Utility functions for type checking)
// ============================================================================

export function isTypeDeclaration(node: ASTNode): node is TypeDeclarationNode {
  return node.type === 'TypeDeclaration';
}

export function isInterfaceDeclaration(node: ASTNode): node is InterfaceDeclarationNode {
  return node.type === 'InterfaceDeclaration';
}

export function isVariableDeclaration(node: ASTNode): node is VariableDeclarationNode {
  return node.type === 'VariableDeclaration';
}

export function isFunctionDeclaration(node: ASTNode): node is FunctionDeclarationNode {
  return node.type === 'FunctionDeclaration';
}

export function isReturnStatement(node: ASTNode): node is ReturnStatementNode {
  return node.type === 'ReturnStatement';
}

export function isIfStatement(node: ASTNode): node is IfStatementNode {
  return node.type === 'IfStatement';
}

export function isForStatement(node: ASTNode): node is ForStatementNode {
  return node.type === 'ForStatement';
}

export function isExpressionStatement(node: ASTNode): node is ExpressionStatementNode {
  return node.type === 'ExpressionStatement';
}

export function isBinaryExpression(node: ASTNode): node is BinaryExpressionNode {
  return node.type === 'BinaryExpression';
}

export function isUnaryExpression(node: ASTNode): node is UnaryExpressionNode {
  return node.type === 'UnaryExpression';
}

export function isCallExpression(node: ASTNode): node is CallExpressionNode {
  return node.type === 'CallExpression';
}

export function isMemberExpression(node: ASTNode): node is MemberExpressionNode {
  return node.type === 'MemberExpression';
}

export function isArrayExpression(node: ASTNode): node is ArrayExpressionNode {
  return node.type === 'ArrayExpression';
}

export function isObjectExpression(node: ASTNode): node is ObjectExpressionNode {
  return node.type === 'ObjectExpression';
}

export function isIdentifier(node: ASTNode): node is IdentifierNode {
  return node.type === 'Identifier';
}

export function isLiteral(node: ASTNode): node is LiteralNode {
  return node.type === 'Literal';
}

export function isConditionalExpression(node: ASTNode): node is ConditionalExpressionNode {
  return node.type === 'ConditionalExpression';
}

export function isArrowFunction(node: ASTNode): node is ArrowFunctionNode {
  return node.type === 'ArrowFunction';
}

export function isAssignmentExpression(node: ASTNode): node is AssignmentExpressionNode {
  return node.type === 'AssignmentExpression';
}

export function isAwaitExpression(node: ASTNode): node is AwaitExpressionNode {
  return node.type === 'AwaitExpression';
}

// ============================================================================
// AST Visitor Pattern (Optional utility for traversing AST)
// ============================================================================

export interface ASTVisitor {
  visitProgram?(node: ProgramNode): void;
  visitTypeDeclaration?(node: TypeDeclarationNode): void;
  visitInterfaceDeclaration?(node: InterfaceDeclarationNode): void;
  visitVariableDeclaration?(node: VariableDeclarationNode): void;
  visitFunctionDeclaration?(node: FunctionDeclarationNode): void;
  visitReturnStatement?(node: ReturnStatementNode): void;
  visitIfStatement?(node: IfStatementNode): void;
  visitForStatement?(node: ForStatementNode): void;
  visitExpressionStatement?(node: ExpressionStatementNode): void;
  visitBinaryExpression?(node: BinaryExpressionNode): void;
  visitUnaryExpression?(node: UnaryExpressionNode): void;
  visitCallExpression?(node: CallExpressionNode): void;
  visitMemberExpression?(node: MemberExpressionNode): void;
  visitArrayExpression?(node: ArrayExpressionNode): void;
  visitObjectExpression?(node: ObjectExpressionNode): void;
  visitIdentifier?(node: IdentifierNode): void;
  visitLiteral?(node: LiteralNode): void;
  visitConditionalExpression?(node: ConditionalExpressionNode): void;
  visitArrowFunction?(node: ArrowFunctionNode): void;
  visitAssignmentExpression?(node: AssignmentExpressionNode): void;
  visitAwaitExpression?(node: AwaitExpressionNode): void;
}

export function visitNode(node: ASTNode, visitor: ASTVisitor): void {
  switch (node.type) {
    case 'Program':
      visitor.visitProgram?.(node);
      node.body.forEach(child => visitNode(child, visitor));
      break;
    case 'TypeDeclaration':
      visitor.visitTypeDeclaration?.(node);
      break;
    case 'InterfaceDeclaration':
      visitor.visitInterfaceDeclaration?.(node);
      break;
    case 'VariableDeclaration':
      visitor.visitVariableDeclaration?.(node);
      visitNode(node.value, visitor);
      break;
    case 'FunctionDeclaration':
      visitor.visitFunctionDeclaration?.(node);
      node.body.forEach(child => visitNode(child, visitor));
      break;
    case 'ReturnStatement':
      visitor.visitReturnStatement?.(node);
      if (node.value) visitNode(node.value, visitor);
      break;
    case 'IfStatement':
      visitor.visitIfStatement?.(node);
      visitNode(node.condition, visitor);
      node.consequent.forEach(child => visitNode(child, visitor));
      node.alternate?.forEach(child => visitNode(child, visitor));
      break;
    case 'ForStatement':
      visitor.visitForStatement?.(node);
      visitNode(node.iterable, visitor);
      node.body.forEach(child => visitNode(child, visitor));
      break;
    case 'ExpressionStatement':
      visitor.visitExpressionStatement?.(node);
      visitNode(node.expression, visitor);
      break;
    case 'BinaryExpression':
      visitor.visitBinaryExpression?.(node);
      visitNode(node.left, visitor);
      visitNode(node.right, visitor);
      break;
    case 'UnaryExpression':
      visitor.visitUnaryExpression?.(node);
      visitNode(node.operand, visitor);
      break;
    case 'CallExpression':
      visitor.visitCallExpression?.(node);
      visitNode(node.callee, visitor);
      node.arguments.forEach(arg => visitNode(arg, visitor));
      break;
    case 'MemberExpression':
      visitor.visitMemberExpression?.(node);
      visitNode(node.object, visitor);
      break;
    case 'ArrayExpression':
      visitor.visitArrayExpression?.(node);
      node.elements.forEach(el => visitNode(el, visitor));
      break;
    case 'ObjectExpression':
      visitor.visitObjectExpression?.(node);
      node.properties.forEach(prop => visitNode(prop.value, visitor));
      break;
    case 'Identifier':
      visitor.visitIdentifier?.(node);
      break;
    case 'Literal':
      visitor.visitLiteral?.(node);
      break;
    case 'ConditionalExpression':
      visitor.visitConditionalExpression?.(node);
      visitNode(node.test, visitor);
      visitNode(node.consequent, visitor);
      visitNode(node.alternate, visitor);
      break;
    case 'ArrowFunction':
      visitor.visitArrowFunction?.(node);
      visitNode(node.body, visitor);
      break;
    case 'AssignmentExpression':
      visitor.visitAssignmentExpression?.(node);
      visitNode(node.target, visitor);
      visitNode(node.value, visitor);
      break;
    case 'AwaitExpression':
      visitor.visitAwaitExpression?.(node);
      visitNode(node.argument, visitor);
      break;
  }
}

// ============================================================================
// Example Usage
// ============================================================================

/*
// Creating AST nodes manually
const program: ProgramNode = {
  type: 'Program',
  body: [
    {
      type: 'TypeDeclaration',
      name: 'SpellLevel',
      typeAnnotation: {
        type: 'PrimitiveType',
        name: 'number'
      }
    },
    {
      type: 'InterfaceDeclaration',
      name: 'Spell',
      properties: [
        {
          key: 'name',
          typeAnnotation: { type: 'PrimitiveType', name: 'string' }
        },
        {
          key: 'level',
          typeAnnotation: { type: 'PrimitiveType', name: 'number' }
        }
      ]
    },
    {
      type: 'VariableDeclaration',
      identifier: 'maxLevel',
      constant: true,
      typeAnnotation: { type: 'PrimitiveType', name: 'number' },
      value: {
        type: 'Literal',
        value: 3
      }
    },
    {
      type: 'FunctionDeclaration',
      name: 'getSpells',
      params: [
        {
          name: 'level',
          typeAnnotation: { type: 'PrimitiveType', name: 'number' }
        }
      ],
      returnTypeAnnotation: {
        type: 'ArrayType',
        elementType: { type: 'TypeReference', name: 'Spell' }
      },
      body: [
        {
          type: 'ReturnStatement',
          value: {
            type: 'CallExpression',
            callee: {
              type: 'MemberExpression',
              object: {
                type: 'MemberExpression',
                object: { type: 'Identifier', name: 'casting' },
                property: 'spells',
                computed: false
              },
              property: 'filter',
              computed: false
            },
            arguments: [
              {
                type: 'ArrowFunction',
                params: ['s'],
                body: {
                  type: 'BinaryExpression',
                  operator: '<=',
                  left: {
                    type: 'MemberExpression',
                    object: { type: 'Identifier', name: 's' },
                    property: 'level',
                    computed: false
                  },
                  right: { type: 'Identifier', name: 'level' }
                }
              }
            ]
          }
        }
      ]
    }
  ]
};

// Using type guards
for (const node of program.body) {
  if (isTypeDeclaration(node)) {
    console.log('Found type:', node.name);
  } else if (isInterfaceDeclaration(node)) {
    console.log('Found interface:', node.name);
  } else if (isFunctionDeclaration(node)) {
    console.log('Found function:', node.name);
  }
}

// Using visitor pattern
const visitor: ASTVisitor = {
  visitTypeDeclaration(node) {
    console.log('Type:', node.name);
  },
  visitInterfaceDeclaration(node) {
    console.log('Interface:', node.name);
  },
  visitFunctionDeclaration(node) {
    console.log('Function:', node.name);
  }
};

visitNode(program, visitor);
*/