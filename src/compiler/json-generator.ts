// ============================================================================
// JSON Code Generator - Generates JSON Instructions
// ============================================================================

import { ProgramNode, ASTNode } from "./ast";
import { Instruction } from "./instructions";

export class JSONCodeGenerator {
  generate(ast: ProgramNode): Instruction[] {
    return ast.body.flatMap(stmt => this.generateStatement(stmt));
  }

  private generateStatement(node: ASTNode): Instruction[] {
    switch (node.type) {
      case 'VariableDeclaration':
        return [{
          type: 'declare_var',
          name: node.identifier,
          value: this.generateExpression(node.value),
          constant: node.constant
        }];

      case 'ExpressionStatement':
        if (node.expression.type === 'CallExpression' && (node.expression as any).callee.type === 'Identifier' && (node.expression as any).callee.name === 'print') {
          return [{
            type: 'print',
            value: this.generateExpression((node.expression as any).arguments[0])
          }];
        } else if (node.expression.type === 'AssignmentExpression') {
          return this.generateAssignment(node.expression as any);
        }
        // For other expressions, perhaps assign or something, but for now, ignore
        return [];

      case 'IfStatement':
        return [{
          type: 'if',
          condition: this.generateExpression(node.condition),
          then: node.consequent.flatMap(s => this.generateStatement(s)),
          else: node.alternate ? node.alternate.flatMap(s => this.generateStatement(s)) : undefined
        }];

      case 'ForStatement':
        return [{
          type: 'for',
          variable: node.variable,
          iterable: this.generateExpression(node.iterable),
          body: node.body.flatMap(s => this.generateStatement(s)),
          async: node.async
        }];

      case 'FunctionDeclaration':
        return [{
          type: 'function_decl',
          name: node.name,
          params: node.params.map(p => p.name),
          body: node.body.flatMap(s => this.generateStatement(s)),
          async: node.async
        }];

      case 'ReturnStatement':
        return [{
          type: 'return',
          value: node.value ? this.generateExpression(node.value) : undefined
        }];

      // Add more cases as needed
      default:
        return [];
    }
  }

  private generateAssignment(assignExpr: any): Instruction[] {
    const value = this.generateExpression(assignExpr.value);
    if (assignExpr.target.type === 'Identifier') {
      return [{
        type: 'assign',
        name: assignExpr.target.name,
        value
      }];
    } else if (assignExpr.target.type === 'MemberExpression') {
      const path = this.generatePath(assignExpr.target);
      return [{
        type: 'set',
        path,
        value
      }];
    }
    return [];
  }

  private generatePath(node: any): string[] {
    if (node.type === 'MemberExpression') {
      const basePath = this.generatePath(node.object);
      let prop: string;
      if (node.computed) {
        // For computed properties, we need to handle expressions
        // For now, assume it's a literal or simple case
        if (node.property.type === 'Literal') {
          prop = String(node.property.value);
        } else {
          // This would need more complex handling for dynamic properties
          throw new Error('Computed property assignments not fully supported yet');
        }
      } else {
        prop = node.property;
      }
      return [...basePath, prop];
    } else if (node.type === 'Identifier') {
      return [node.name];
    }
    return [];
  }

  private generateExpression(node: ASTNode): any {
    switch (node.type) {
      case 'Literal':
        return node.value;
      case 'Identifier':
        return { type: 'var', name: node.name };
      case 'BinaryExpression':
        return {
          type: 'binary',
          operator: node.operator,
          left: this.generateExpression(node.left),
          right: this.generateExpression(node.right)
        };
      case 'CallExpression':
        return {
          type: 'call_expr',
          callee: this.generateExpression(node.callee),
          args: node.arguments.map(arg => this.generateExpression(arg))
        };
      case 'ArrayExpression':
        return {
          type: 'array',
          elements: node.elements.map(elem => this.generateExpression(elem))
        };
      case 'ObjectExpression':
        return {
          type: 'object',
          properties: node.properties.map(prop => ({
            key: prop.key,
            value: this.generateExpression(prop.value)
          }))
        };
      case 'MemberExpression':
        return {
          type: 'member_access',
          object: this.generateExpression(node.object),
          property: node.computed
            ? typeof node.property === 'string'
              ? node.property
              : this.generateExpression(node.property as ASTNode)
            : node.property,
          computed: node.computed
        };
      case 'AwaitExpression':
        return {
          type: 'await',
          expression: this.generateExpression(node.argument)
        };
      case 'ArrowFunction':
        return {
          type: 'arrow_function',
          params: node.params,
          body: this.generateExpression(node.body)
        };
      // Add more expression types
      default:
        return null;
    }
  }
}