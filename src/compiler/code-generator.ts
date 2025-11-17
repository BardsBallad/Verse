// ============================================================================
// CODE GENERATOR - Compiles to JavaScript with Async/Await
// ============================================================================

import { ProgramNode, ASTNode, ObjectExpressionNode } from "./ast";

export class CodeGenerator {
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

        // If this variable has a type annotation that is a named type (TypeReference)
        // and the value is an object literal, inject a `_type` property so runtime
        // objects carry their declared type name.
        if (node.value.type === 'ObjectExpression' && node.typeAnnotation && (node.typeAnnotation as any).type === 'TypeReference') {
          const typeName = (node.typeAnnotation as any).name;
          return `${keyword} ${node.identifier} = ${this.generateObjectExpression(node.value as any, typeName)};`;
        }

        return `${keyword} ${node.identifier} = ${this.generateExpression(node.value)};`;
      
      case 'FunctionDeclaration':
        const asyncKeyword = node.async ? 'async ' : '';
        const params = node.params.map(p => p.name).join(', ');
        const body = node.body.map(s => this.generateStatement(s)).join('\n');
        return `${asyncKeyword}function ${node.name}(${params}) {\n${body}\n}`;
      
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
        const awaitKeyword = node.async ? 'await ' : '';
        const iterable = this.generateExpression(node.iterable);
        const forBody = node.body.map(s => this.generateStatement(s)).join('\n');
        return `for ${awaitKeyword}(const ${node.variable} of ${iterable}) {\n${forBody}\n}`;
      
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
        if (node.computed) {
          // property may be a string (from a literal) or an expression AST node
          if (typeof node.property === 'string') {
            // numeric string -> emit as number, otherwise emit as quoted string
            if (/^-?\d+$/.test(node.property)) {
              return `${object}[${node.property}]`;
            }
            return `${object}[${JSON.stringify(node.property)}]`;
          }
          return `${object}[${this.generateExpression(node.property)}]`;
        }

        return `${object}.${node.property}`;
      
      case 'ArrayExpression':
        const elements = node.elements.map(el => this.generateExpression(el)).join(', ');
        return `[${elements}]`;
      
      case 'ObjectExpression':
        return this.generateObjectExpression(node as ObjectExpressionNode);
      
      case 'ConditionalExpression':
        return `(${this.generateExpression(node.test)} ? ${this.generateExpression(node.consequent)} : ${this.generateExpression(node.alternate)})`;
      
      case 'ArrowFunction':
        const asyncArrow = node.async ? 'async ' : '';
        const fnParams = node.params.join(', ');
        const fnBody = this.generateExpression(node.body);
        return `${asyncArrow}(${fnParams}) => ${fnBody}`;
      
      case 'AssignmentExpression':
        return `${this.generateExpression(node.target)} = ${this.generateExpression(node.value)}`;
      
      case 'AwaitExpression':
        return `await ${this.generateExpression(node.argument)}`;
      
      default:
        return '';
    }
  }

  // Generate an object literal, optionally injecting a leading `_type` property
  // when `typeName` is provided.
  private generateObjectExpression(node: ObjectExpressionNode, typeName?: string): string {
    const parts: string[] = [];

    // If object already contains an explicit `_type` property, don't inject.
    const hasExplicitTypeProp = node.properties.some(p => p.key === '_type');

    if (typeName && !hasExplicitTypeProp) {
      parts.push(`_type: ${JSON.stringify(typeName)}`);
    }

    for (const p of node.properties) {
      parts.push(`${p.key}: ${this.generateExpression(p.value)}`);
    }

    return `{ ${parts.join(', ')} }`;
  }
}