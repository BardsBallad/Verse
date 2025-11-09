// ============================================================================
// CODE GENERATOR - Compiles to JavaScript
// ============================================================================

import { ProgramNode, ASTNode } from "./type-checker";

export default class CodeGenerator {
  generate(ast: ProgramNode): string {
    return ast.body.map(stmt => this.generateStatement(stmt)).join('\n');
  }
  
  private generateStatement(node: ASTNode): string {
    switch (node.type) {
      case 'VariableDeclaration':
        const keyword = node.constant ? 'const' : 'let';
        return `${keyword} ${node.identifier} = ${this.generateExpression(node.value)};`;
      
      case 'FunctionDeclaration':
        const params = node.params.join(', ');
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