// ============================================================================
// CODE GENERATOR - Compiles to JavaScript with Async/Await
// ============================================================================

import type { ProgramNode, ASTNode, ObjectExpressionNode, VariableDeclarationNode, TypeReferenceAnnotation, FunctionDeclarationNode, ForStatementNode, IdentifierNode, MemberExpressionNode, LiteralNode, CallExpressionNode } from "./ast";

export class CodeGenerator {
  private globalGet?: string;
  private globalSet?: string;
  // stack of scopes, each is a set of declared local variable names
  private scopes: Set<string>[] = [];

  constructor(options?: { globalGet?: string; globalSet?: string }) {
    this.globalGet = options?.globalGet;
    this.globalSet = options?.globalSet;
  }

  generate(ast: ProgramNode): string {
    // reset scopes for each generation; top-level scope holds variables declared in the script
    this.scopes = [new Set<string>()];
    return ast.body.map(stmt => this.generateStatement(stmt)).filter(line => line !== '').join('\n');
  }

  private currentScope(): Set<string> {
    return this.scopes[this.scopes.length - 1];
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

        // Use typed variable-declaration node
        const vNode = node as VariableDeclarationNode;

        // Register declared variable in current scope
        this.currentScope().add(vNode.identifier);
        if (vNode.value.type === 'ObjectExpression' && vNode.typeAnnotation && vNode.typeAnnotation.type === 'TypeReference') {
          const typeName = (vNode.typeAnnotation as TypeReferenceAnnotation).name;
          return `${keyword} ${vNode.identifier} = ${this.generateObjectExpression(vNode.value as ObjectExpressionNode, typeName)};`;
        }

        return `${keyword} ${vNode.identifier} = ${this.generateExpression(vNode.value)};`;
      
      case 'FunctionDeclaration':
        // Typed function node
        const fNode = node as FunctionDeclarationNode;

        // Register function name in current scope
        this.currentScope().add(fNode.name);

        const asyncKeyword = fNode.async ? 'async ' : '';
        const params = fNode.params.map(p => p.name).join(', ');

        // Create a new scope for the function body and register params
        this.scopes.push(new Set<string>());
        for (const p of fNode.params) this.currentScope().add(p.name);
        const body = fNode.body.map(s => this.generateStatement(s)).join('\n');
        this.scopes.pop();

        return `${asyncKeyword}function ${fNode.name}(${params}) {\n${body}\n}`;
      
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
        const forNode = node as ForStatementNode;
        const awaitKeyword = forNode.async ? 'await ' : '';
        const iterable = this.generateExpression(forNode.iterable);

        // loop variable is local to loop body
        this.scopes.push(new Set<string>());
        this.currentScope().add(forNode.variable);
        const forBody = forNode.body.map(s => this.generateStatement(s)).join('\n');
        this.scopes.pop();
        return `for ${awaitKeyword}(const ${forNode.variable} of ${iterable}) {\n${forBody}\n}`;
      
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
        // If identifier is not declared in any script scope, treat as global and
        // use configured global getter if provided.
        if (!this.isDeclared(node.name) && this.globalGet) {
          return `await ${this.globalGet}(${node.name})`;
        }
        return node.name;
      
      case 'BinaryExpression':
        return `(${this.generateExpression(node.left)} ${node.operator} ${this.generateExpression(node.right)})`;
      
      case 'UnaryExpression':
        return `${node.operator}${this.generateExpression(node.operand)}`;
      
      case 'CallExpression':
        // If calling a member method on a global path (e.g. character.spells.filter(...))
        // we want to call the configured global getter for the base path and then
        // invoke the method on the returned value: getValue("character.spells").filter(...)
        const callNode = node as CallExpressionNode;
        const args = callNode.arguments.map((arg: ASTNode) => this.generateExpression(arg)).join(', ');

        if (callNode.callee.type === 'MemberExpression') {
          const me = callNode.callee as MemberExpressionNode;
          const basePath = this.buildPathFromMember(me.object);
          if (basePath && this.globalGet) {
            const getterExpr = `${this.globalGet}(${JSON.stringify(basePath)})`;

            // build access to method on the returned value
            let access = '';
            if (me.computed) {
              if (typeof me.property === 'string') {
                if (/^-?\d+$/.test(me.property)) {
                  access = `[${me.property}]`;
                } else {
                  access = `[${JSON.stringify(me.property)}]`;
                }
              } else {
                access = `[${this.generateExpression(me.property)}]`;
              }
            } else {
              access = `.${me.property}`;
            }

            return `(await ${getterExpr})${access}(${args})`;
          }
        }

        const callee = this.generateExpression(node.callee);
        return `${callee}(${args})`;
      
      case 'MemberExpression':
        // Try to resolve a static path for a chain that starts from an undeclared
        // identifier (a global). If successful and a global getter is configured,
        // emit `getGlobal("path")` instead of dotted access.
        const maybePath = this.buildPathFromMember(node as MemberExpressionNode);
        if (maybePath && this.globalGet) {
          return `await ${this.globalGet}(${maybePath})`;
        }

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
        // If the AST node was annotated with an inferred type name during
        // compilation, pass it so we inject `_type` for inline object literals.
        const inferred = (node as unknown as { __inferredTypeName?: string }).__inferredTypeName;
        return this.generateObjectExpression(node as ObjectExpressionNode, inferred);
      
      case 'ConditionalExpression':
        return `(${this.generateExpression(node.test)} ? ${this.generateExpression(node.consequent)} : ${this.generateExpression(node.alternate)})`;
      
      case 'ArrowFunction':
        const asyncArrow = node.async ? 'async ' : '';
        const fnParams = node.params.join(', ');
        // Arrow function params are local to the arrow function body
        this.scopes.push(new Set<string>());
        for (const p of node.params) this.currentScope().add(p);
        const fnBody = this.generateExpression(node.body);
        this.scopes.pop();
        return `${asyncArrow}(${fnParams}) => ${fnBody}`;
      
      case 'AssignmentExpression':
        // If assigning to an undeclared identifier (global) and a custom setter
        // is configured, emit the setter call instead of a plain assignment.
          if (node.target.type === 'Identifier') {
            const name = (node.target as IdentifierNode).name;
            if (!this.isDeclared(name) && this.globalSet) {
              return `await ${this.globalSet}(${name}, ${this.generateExpression(node.value)})`;
            }
          }

          // If assigning to a member expression that can be resolved to a global
          // path, use the global setter helper instead of emitting a direct
          // property assignment which may not affect the external store.
          if (node.target.type === 'MemberExpression') {
            const path = this.buildPathFromMember(node.target);
            if (path && this.globalSet) {
              return `await ${this.globalSet}(${path}, ${this.generateExpression(node.value)})`;
            }
          }

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

  private isDeclared(name: string): boolean {
    return this.scopes.some(s => s.has(name));
  }

  // Attempt to build a string path for a chain of member expressions that
  // originate from an undeclared identifier (global). Returns null if the
  // chain is not statically resolvable.
  private buildPathFromMember(node: ASTNode): string | null {
    if (node.type === 'Identifier') {
      const id = node as IdentifierNode;
      return !this.isDeclared(id.name) ? id.name : null;
    }

    if (node.type === 'MemberExpression') {
      const me = node as MemberExpressionNode;
      const base = this.buildPathFromMember(me.object);
      if (!base) return null;

      let propPart: string | null = null;
      if (me.computed) {
        if (typeof me.property === 'string') {
          propPart = me.property;
        } else if (me.property.type === 'Literal') {
          const v = (me.property as LiteralNode).value;
          if (typeof v === 'string' || typeof v === 'number') propPart = String(v);
          else return null;
        } else {
          return null;
        }
      } else {
        propPart = me.property as string;
      }

      if (propPart === null) return null;
      if (/^-?\d+$/.test(propPart)) {
        return `${base}[${propPart}]`;
      }
      return `${base}.${propPart}`;
    }

    return null;
  }
}