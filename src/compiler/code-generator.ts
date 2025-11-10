// ============================================================================
// CODE GENERATOR - Compiles to JavaScript
// ============================================================================

import { ProgramNode, ASTNode } from "./ast";
import Lexer from "./lexer";
import Parser from "./parser";
import TypeChecker, { Type } from "./type-checker";

export default class CodeGenerator {
  generate(ast: ProgramNode): string {
    return ast.body.map(stmt => this.generateStatement(stmt)).filter(line => line !== '').join('\n');
  }
  
  private generateStatement(node: ASTNode): string {
    switch (node.type) {
      case 'TypeDeclaration':
        // Type declarations don't generate runtime code
        return ``;
      
      case 'InterfaceDeclaration':
        // Interface declarations don't generate runtime code
        return ``;
      
      case 'VariableDeclaration':
        const keyword = node.constant ? 'const' : 'let';
        return `${keyword} ${node.identifier} = ${this.generateExpression(node.value)};`;
      
      case 'FunctionDeclaration':
        const params = node.params.map(p => p.name).join(', ');
        const body = node.body.map(s => this.generateStatement(s)).join('\n');
        return `function ${node.name}(${params}) {\n${body}\n}`;
      
      case 'ReturnStatement':
        return node.value ? `return ${this.generateExpression(node.value)};` : 'return;';
      
      case 'IfStatement':
        const condition = this.generateExpression(node.condition);
        const consequent = node.consequent.map(s => this.generateStatement(s)).join('\n');
        const alternate = node.alternate 
          ? `else {\n${node.alternate.map(s => this.generateStatement(s)).join('\n')}\n}`
          : '';
        return `if (${condition}) {\n${consequent}\n} ${alternate}`;
      
      case 'ForStatement':
        const iterable = this.generateExpression(node.iterable);
        const forBody = node.body.map(s => this.generateStatement(s)).join('\n');
        return `for (const ${node.variable} of ${iterable}) {\n${forBody}\n}`;
      
      case 'ExpressionStatement':
        return `${this.generateExpression(node.expression)};`;
      
      default:
        return '';
    }
  }
  
  private generateExpression(node: ASTNode): string {
    switch (node.type) {
      case 'Literal':
        if (typeof node.value === 'string') return `"${node.value}"`;
        return String(node.value);
      
      case 'Identifier':
        return node.name;
      
      case 'BinaryExpression':
        return `(${this.generateExpression(node.left)} ${node.operator} ${this.generateExpression(node.right)})`;
      
      case 'UnaryExpression':
        return `${node.operator}${this.generateExpression(node.operand)}`;
      
      case 'CallExpression':
        const callee = this.generateExpression(node.callee);
        const args = node.arguments.map(arg => this.generateExpression(arg)).join(', ');
        return `${callee}(${args})`;
      
      case 'MemberExpression':
        const object = this.generateExpression(node.object);
        return node.computed 
          ? `${object}[${node.property}]`
          : `${object}.${node.property}`;
      
      case 'ArrayExpression':
        const elements = node.elements.map(el => this.generateExpression(el)).join(', ');
        return `[${elements}]`;
      
      case 'ObjectExpression':
        const props = node.properties
          .map(p => `${p.key}: ${this.generateExpression(p.value)}`)
          .join(', ');
        return `{ ${props} }`;
      
      case 'ConditionalExpression':
        return `(${this.generateExpression(node.test)} ? ${this.generateExpression(node.consequent)} : ${this.generateExpression(node.alternate)})`;
      
      case 'ArrowFunction':
        const fnParams = node.params.join(', ');
        const fnBody = this.generateExpression(node.body);
        return `(${fnParams}) => ${fnBody}`;
      
      case 'AssignmentExpression':
        return `${this.generateExpression(node.target)} = ${this.generateExpression(node.value)}`;
      
      default:
        return '';
    }
  }
}

// ============================================================================
// MAIN COMPILER API
// ============================================================================

interface CompileResult {
  success: boolean;
  returnType?: string;
  code?: string;
  error?: string;
}

export class TTRPGScriptCompiler {
  private typeChecker: TypeChecker;
  
  constructor(contextTypes?: Record<string, Type>) {
    this.typeChecker = new TypeChecker(contextTypes);
  }
  
  registerType(name: string, type: Type) {
    this.typeChecker.registerType(name, type);
  }
  
  compile(source: string): CompileResult {
    try {
      // Lexical analysis
      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();
      
      // Parsing
      const parser = new Parser(tokens);
      const ast = parser.parse();
      
      // Type checking and inference
      const returnType = this.typeChecker.inferReturnType(ast);
      const returnTypeStr = this.typeChecker.typeToString(returnType);
      
      // Code generation
      const generator = new CodeGenerator();
      const code = generator.generate(ast);
      
      return {
        success: true,
        returnType: returnTypeStr,
        code,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  // Helper to create type definitions
  static createObjectType(name: string, properties: Record<string, Type>): Type {
    return { kind: 'object', name, properties };
  }
  
  static createArrayType(elementType: Type): Type {
    return { kind: 'array', elementType };
  }
}