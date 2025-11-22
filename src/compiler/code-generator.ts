// ============================================================================
// CODE GENERATOR - Compiles to JavaScript with Async/Await
// ============================================================================

import type { ProgramNode, ASTNode, ObjectExpressionNode, VariableDeclarationNode, TypeReferenceAnnotation, FunctionDeclarationNode, ForStatementNode, IdentifierNode, MemberExpressionNode, CallExpressionNode } from "./ast";

export class CodeGenerator {

  // stack of scopes, each is a set of declared local variable names
  private scopes: Set<string>[] = [];
  // stack tracking whether the current lexical context is async (functions)
  private asyncContextStack: boolean[] = [];

  constructor() {}

  generate(ast: ProgramNode): string {
    // reset scopes for each generation; top-level scope holds variables declared in the script
    this.scopes = [new Set<string>()];
    // top-level is executed inside an async wrapper, treat as async
    this.asyncContextStack = [true];
    return ast.body.map(stmt => this.generateStatement(stmt)).filter(line => line !== '').join('\n');
  }

  private isInAsyncContext(): boolean {
    return this.asyncContextStack.length > 0 && this.asyncContextStack[this.asyncContextStack.length - 1];
  }

  // Generate member access while ensuring the top-level identifier in the
  // chain is awaited when it's an undeclared global/proxy. This emits
  // expressions like `(await character).stats[0].prop` or `(await fn)(...)`.
  private generateMemberAccess(node: MemberExpressionNode, isCall: boolean = false, forAssignment: boolean = false): string {
    // Flatten the member chain into root + props
    const parts: Array<{ prop: string | ASTNode; computed: boolean }> = [];
    let cur: ASTNode | MemberExpressionNode = node as MemberExpressionNode;
    while (cur.type === 'MemberExpression') {
      parts.unshift({ prop: cur.property, computed: cur.computed });
      cur = cur.object as ASTNode;
    }

    const root = cur as ASTNode;

    // Build base string without inserting any `await` for the root identifier
    const buildWithoutAwait = (n: ASTNode): string => {
      if (n.type === 'Identifier') return (n as IdentifierNode).name;
      // For other nodes, reuse generateExpression (it may contain awaits itself)
      const e = this.generateExpression(n);
      return `(${e})`;
    };

    let chain = buildWithoutAwait(root);
    for (let i = 0; i < parts.length; i++) {
      const { prop, computed } = parts[i];
      if (computed) {
        if (typeof prop === 'string') {
          if (/^-?\d+$/.test(prop)) chain += `[${prop}]`;
          else chain += `[${JSON.stringify(prop)}]`;
        } else {
          chain += `[${this.generateExpression(prop)}]`;
        }
      } else {
        chain += `.${prop}`;
      }
    }

    // If this member access is used as a callee and the final property is
    // an array-like method, await the entire chain up to (but not including)
    // the final method so that methods like .find/.filter are invoked on the
    // resolved array object: (await <chain-before-method>).find(...)
    const arrayMethods = new Set(['find', 'filter', 'map', 'slice', 'concat', 'at', 'findIndex', 'indexOf', 'some', 'every', 'includes']);
    if (isCall && parts.length > 0) {
      const last = parts[parts.length - 1];
      if (!last.computed && typeof last.prop === 'string' && arrayMethods.has(last.prop)) {
        // build chain before last
        let before = buildWithoutAwait(root);
        for (let i = 0; i < parts.length - 1; i++) {
          const { prop, computed } = parts[i];
          if (computed) {
            if (typeof prop === 'string') {
              if (/^-?\d+$/.test(prop)) before += `[${prop}]`;
              else before += `[${JSON.stringify(prop)}]`;
            } else {
              before += `[${this.generateExpression(prop)}]`;
            }
          } else {
            before += `.${prop}`;
          }
        }

        let methodAccess: string;
        if (!last.computed) {
          methodAccess = `.${last.prop}`;
        } else {
          if (typeof last.prop === 'string') {
            if (/^-?\d+$/.test(last.prop)) methodAccess = `[${last.prop}]`;
            else methodAccess = `[${JSON.stringify(last.prop)}]`;
          } else {
            methodAccess = `[${this.generateExpression(last.prop as ASTNode)}]`;
          }
        }

        // Only await the base when we're in an async context and the root
        // identifier is undeclared (global/proxy). Otherwise call the method
        // directly on the unevaluated chain.
        if (this.isInAsyncContext() && root.type === 'Identifier' && !this.isDeclared((root as IdentifierNode).name)) {
          return `(await ${before})${methodAccess}`;
        }
        return `${before}${methodAccess}`;
      }
    }

    // Special-case: trailing numeric/computed index like `...spells[0]`.
    // Prefer `(await <chain-before-index>)[index]` when the root is an
    // undeclared global/proxy and we're in an async context, so that the
    // awaited value is the array rather than the whole chain being awaited
    // producing `(await root).spells[0]`.
    if (!forAssignment && parts.length > 0) {
      const lastPart = parts[parts.length - 1];
      const isNumericIndex = lastPart.computed && (
        (typeof lastPart.prop === 'string' && (/^-?\d+$/.test(lastPart.prop))) ||
        (typeof lastPart.prop !== 'string' && (lastPart.prop as ASTNode).type === 'Literal' && typeof ((lastPart.prop as any).value) === 'number')
      );

      if (isNumericIndex) {
        // build chain before last
        let before = buildWithoutAwait(root);
        for (let i = 0; i < parts.length - 1; i++) {
          const { prop, computed } = parts[i];
          if (computed) {
            if (typeof prop === 'string') {
              if (/^-?\d+$/.test(prop)) before += `[${prop}]`;
              else before += `[${JSON.stringify(prop)}]`;
            } else {
              before += `[${this.generateExpression(prop)}]`;
            }
          } else {
            before += `.${prop}`;
          }
        }

        // index expression
        let indexExpr: string;
        if (typeof lastPart.prop === 'string') indexExpr = lastPart.prop;
        else indexExpr = this.generateExpression(lastPart.prop as ASTNode);

        if (this.isInAsyncContext() && root.type === 'Identifier' && !this.isDeclared((root as IdentifierNode).name)) {
          return `(await ${before})[${indexExpr}]`;
        }

        return `${before}[${indexExpr}]`;
      }
    }

    // If this member expression is the target of an assignment, we cannot
    // emit `await (<expr>) = value` (invalid). Instead await only the root
    // object (if undeclared) so we can produce a valid l-value like
    // `(await root).prop = value`.
    if (forAssignment) {
      if (root.type === 'Identifier') {
        const id = root as IdentifierNode;
        const rest = chain.slice(id.name.length);
        return (!this.isDeclared(id.name) && this.isInAsyncContext()) ? `(await ${id.name})${rest}` : `${id.name}${rest}`;
      }
      // If root is not an identifier, fall back to generating the expression
      // and using it as the base (wrapped in parens).
      const base = `(${this.generateExpression(root)})`;
      return `${base}${chain.slice(buildWithoutAwait(root).length)}`;
    }

    // Default read behavior: only await the root identifier if it's
    // undeclared and we're in an async context. This avoids generating
    // `await (s.level)` when `s` is a local value.
    if (root.type === 'Identifier') {
      const id = root as IdentifierNode;
      const rest = chain.slice(id.name.length);
      return (!this.isDeclared(id.name) && this.isInAsyncContext()) ? `(await ${id.name})${rest}` : `${id.name}${rest}`;
    }
    const base = `(${this.generateExpression(root)})`;
    return `${base}${chain.slice(buildWithoutAwait(root).length)}`;
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

        // Create a new scope for the function body and register params.
        // Also track whether the function is async so inner awaits are only
        // inserted when appropriate.
        this.scopes.push(new Set<string>());
        this.asyncContextStack.push(fNode.async);
        for (const p of fNode.params) this.currentScope().add(p.name);
        const body = fNode.body.map(s => this.generateStatement(s)).join('\n');
        this.asyncContextStack.pop();
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
        // For undeclared identifiers (globals/proxies) we need to await the
        // value since the runtime proxy may return a Promise. When used as a
        // standalone expression this emits `await name`. Call-sites and
        // member-access generation will wrap into parentheses where needed.
        if (!this.isDeclared(node.name) && this.isInAsyncContext()) {
          return `await ${node.name}`;
        }
        return node.name;
      
      case 'BinaryExpression':
        return `(${this.generateExpression(node.left)} ${node.operator} ${this.generateExpression(node.right)})`;
      
      case 'UnaryExpression':
        return `${node.operator}${this.generateExpression(node.operand)}`;
      
      case 'CallExpression':
        const callNode = node as CallExpressionNode;
        const args = callNode.arguments.map((arg: ASTNode) => this.generateExpression(arg)).join(', ');

        // If callee is a member expression, generate the member access while
        // ensuring the top-level identifier is awaited where necessary so that
        // calls like `(await character).stats.find(...)` are emitted.
        if (callNode.callee.type === 'MemberExpression') {
          const me = callNode.callee as MemberExpressionNode;
          const memberAccess = this.generateMemberAccess(me, true, false);
          return `${memberAccess}(${args})`;
        }

        // If callee is an identifier that resolves to a Promise for a function,
        // we need to await the identifier and then call it: `(await fn)(...)`.
        if (callNode.callee.type === 'Identifier') {
          const id = callNode.callee as IdentifierNode;
          if (!this.isDeclared(id.name) && this.isInAsyncContext()) {
            return `(await ${id.name})(${args})`;
          }
        }

        const callee = this.generateExpression(node.callee);
        return `${callee}(${args})`;
      
      case 'MemberExpression':
        return this.generateMemberAccess(node as MemberExpressionNode);
      
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
        // Arrow function params are local to the arrow function body. Track
        // async context according to the node's `async` flag so nested
        // generation knows whether to auto-insert `await`.
        this.scopes.push(new Set<string>());
        this.asyncContextStack.push(node.async);
        for (const p of node.params) this.currentScope().add(p);
        const fnBody = this.generateExpression(node.body);
        this.asyncContextStack.pop();
        this.scopes.pop();
        return `${asyncArrow}(${fnParams}) => ${fnBody}`;
      
      case 'AssignmentExpression':
        // Ensure assignment targets are emitted as valid l-values. For simple
        // identifier targets we emit `name = value` (no await). For member
        // expressions we generate the member access while awaiting the top
        // level identifier if necessary: e.g. `(await obj).prop = value`.
        if (node.target.type === 'Identifier') {
          const name = (node.target as IdentifierNode).name;
          return `${name} = ${this.generateExpression(node.value)}`;
        }

        if (node.target.type === 'MemberExpression') {
          const lhs = this.generateMemberAccess(node.target as MemberExpressionNode, false, true);
          return `${lhs} = ${this.generateExpression(node.value)}`;
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

  
}