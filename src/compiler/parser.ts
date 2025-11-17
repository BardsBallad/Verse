// ============================================================================
// PARSER - Builds AST from tokens with Async/Await support
// ============================================================================

import { ProgramNode, ASTNode, TypeDeclarationNode, InterfaceDeclarationNode, TypeAnnotation, VariableDeclarationNode, FunctionDeclarationNode, ReturnStatementNode, IfStatementNode, ForStatementNode, ExpressionStatementNode } from './ast';
import { Token, TokenType } from './lexer';

export class Parser {
  private tokens: Token[];
  private pos = 0;
  
  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }
  
  parse(): ProgramNode {
    const body: ASTNode[] = [];
    
    while (!this.isAtEnd()) {
      body.push(this.statement());
    }
    
    return { type: 'Program', body };
  }
  
  // ============================================================================
  // Statements
  // ============================================================================
  
  private statement(): ASTNode {
    if (this.match(TokenType.TYPE)) {
      return this.typeDeclaration();
    }
    
    if (this.match(TokenType.INTERFACE)) {
      return this.interfaceDeclaration();
    }
    
    if (this.match(TokenType.LET, TokenType.CONST)) {
      return this.variableDeclaration();
    }
    
    // Check for async function
    if (this.match(TokenType.ASYNC)) {
      if (this.match(TokenType.FN)) {
        return this.functionDeclaration(true);
      }
      throw new Error('Expected "fn" after "async"');
    }
    
    if (this.match(TokenType.FN)) {
      return this.functionDeclaration(false);
    }
    
    if (this.match(TokenType.RETURN)) {
      return this.returnStatement();
    }
    
    if (this.match(TokenType.IF)) {
      return this.ifStatement();
    }
    
    if (this.match(TokenType.FOR)) {
      return this.forStatement();
    }
    
    return this.expressionStatement();
  }
  
  private typeDeclaration(): TypeDeclarationNode {
    const name = this.consume(TokenType.IDENTIFIER, 'Expected type name').value;
    this.consume(TokenType.EQUALS, 'Expected = after type name');
    const typeAnnotation = this.parseTypeAnnotation();
    return { type: 'TypeDeclaration', name, typeAnnotation };
  }
  
  private interfaceDeclaration(): InterfaceDeclarationNode {
    const name = this.consume(TokenType.IDENTIFIER, 'Expected interface name').value;
    this.consume(TokenType.LBRACE, 'Expected { after interface name');
    
    const properties: { key: string; typeAnnotation: TypeAnnotation }[] = [];
    
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      const key = this.consume(TokenType.IDENTIFIER, 'Expected property name').value;
      this.consume(TokenType.COLON, 'Expected : after property name');
      const typeAnnotation = this.parseTypeAnnotation();
      properties.push({ key, typeAnnotation });
      
      // Optional comma
      this.match(TokenType.COMMA);
    }
    
    this.consume(TokenType.RBRACE, 'Expected } after interface body');
    
    return { type: 'InterfaceDeclaration', name, properties };
  }
  
  private variableDeclaration(): VariableDeclarationNode {
    const constant = this.previous().type === TokenType.CONST;
    const identifier = this.consume(TokenType.IDENTIFIER, 'Expected variable name').value;
    
    // Optional type annotation: let x: number = 5
    let typeAnnotation: TypeAnnotation | undefined;
    if (this.match(TokenType.COLON)) {
      typeAnnotation = this.parseTypeAnnotation();
    }
    
    this.consume(TokenType.EQUALS, 'Expected = after variable name');
    const value = this.expression();
    return { type: 'VariableDeclaration', identifier, value, constant, typeAnnotation };
  }
  
  private functionDeclaration(isAsync: boolean): FunctionDeclarationNode {
    const name = this.consume(TokenType.IDENTIFIER, 'Expected function name').value;
    this.consume(TokenType.LPAREN, 'Expected ( after function name');
    
    const params: { name: string; typeAnnotation?: TypeAnnotation }[] = [];
    if (!this.check(TokenType.RPAREN)) {
      do {
        const paramName = this.consume(TokenType.IDENTIFIER, 'Expected parameter name').value;
        
        // Optional type annotation: fn add(a: number, b: number)
        let typeAnnotation: TypeAnnotation | undefined;
        if (this.match(TokenType.COLON)) {
          typeAnnotation = this.parseTypeAnnotation();
        }
        
        params.push({ name: paramName, typeAnnotation });
      } while (this.match(TokenType.COMMA));
    }
    
    this.consume(TokenType.RPAREN, 'Expected ) after parameters');
    
    // Optional return type: fn add() -> number
    let returnTypeAnnotation: TypeAnnotation | undefined;
    if (this.match(TokenType.RETURN_ARROW)) {
      returnTypeAnnotation = this.parseTypeAnnotation();
    }
    
    this.consume(TokenType.LBRACE, 'Expected { before function body');
    
    const body: ASTNode[] = [];
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      body.push(this.statement());
    }
    
    this.consume(TokenType.RBRACE, 'Expected } after function body');
    
    return { type: 'FunctionDeclaration', name, params, returnTypeAnnotation, body, async: isAsync };
  }
  
  private returnStatement(): ReturnStatementNode {
    const value = this.check(TokenType.RBRACE) || this.isAtEnd() ? null : this.expression();
    return { type: 'ReturnStatement', value };
  }
  
  private ifStatement(): IfStatementNode {
    const condition = this.expression();
    this.consume(TokenType.LBRACE, 'Expected { after if condition');
    
    const consequent: ASTNode[] = [];
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      consequent.push(this.statement());
    }
    
    this.consume(TokenType.RBRACE, 'Expected } after if body');
    
    let alternate: ASTNode[] | null = null;
    if (this.match(TokenType.ELSE)) {
      this.consume(TokenType.LBRACE, 'Expected { after else');
      alternate = [];
      while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
        alternate.push(this.statement());
      }
      this.consume(TokenType.RBRACE, 'Expected } after else body');
    }
    
    return { type: 'IfStatement', condition, consequent, alternate };
  }
  
  private forStatement(): ForStatementNode {
    // Check for "await" keyword (for await...of)
    const isAwait = this.match(TokenType.AWAIT);
    
    const variable = this.consume(TokenType.IDENTIFIER, 'Expected variable name in for loop').value;
    this.consume(TokenType.IN, 'Expected "in" in for loop');
    const iterable = this.expression();
    this.consume(TokenType.LBRACE, 'Expected { after for header');
    
    const body: ASTNode[] = [];
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      body.push(this.statement());
    }
    
    this.consume(TokenType.RBRACE, 'Expected } after for body');
    
    return { type: 'ForStatement', variable, iterable, body, async: isAwait };
  }
  
  private expressionStatement(): ExpressionStatementNode {
    const expression = this.expression();
    return { type: 'ExpressionStatement', expression };
  }
  
  // ============================================================================
  // Type Annotations
  // ============================================================================
  
  private parseTypeAnnotation(): TypeAnnotation {
    // Check for Promise<T> syntax
    if (this.check(TokenType.IDENTIFIER) && this.peek().value === 'Promise') {
      this.advance();
      this.consume(TokenType.LESS, 'Expected < after Promise');
      const resolveType = this.parseTypeAnnotation();
      this.consume(TokenType.GREATER, 'Expected > after Promise type');
      return { type: 'PromiseType', resolveType };
    }
    
    // Union type: number | string | null
    const types: TypeAnnotation[] = [];
    
    types.push(this.parseSingleType());
    
    while (this.match(TokenType.PIPE)) {
      types.push(this.parseSingleType());
    }
    
    if (types.length === 1) {
      return types[0];
    }
    
    return { type: 'UnionType', types };
  }
  
  private parseSingleType(): TypeAnnotation {
    // Array type: number[]
    const baseType = this.parseBaseType();
    
    if (this.match(TokenType.LBRACKET)) {
      this.consume(TokenType.RBRACKET, 'Expected ] after [');
      return { type: 'ArrayType', elementType: baseType };
    }
    
    return baseType;
  }
  
  private parseBaseType(): TypeAnnotation {
    const token = this.peek();
    
    // Primitive types
    if (token.type === TokenType.IDENTIFIER) {
      const value = token.value;
      
      if (value === 'number' || value === 'string' || 
          value === 'boolean' || value === 'null') {
        this.advance();
        return { 
          type: 'PrimitiveType', 
          name: value as 'number' | 'string' | 'boolean' | 'null'
        };
      }
    }

    // null gets matched as a token since it's also a value
    if (token.type === TokenType.NULL) {
      this.advance();
      return { 
        type: 'PrimitiveType', 
        name: token.value as 'null'
      };
    }
    
    // Object type: { name: string, level: number }
    if (this.match(TokenType.LBRACE)) {
      const properties: { key: string; valueType: TypeAnnotation }[] = [];
      
      while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
        const key = this.consume(TokenType.IDENTIFIER, 'Expected property name').value;
        this.consume(TokenType.COLON, 'Expected : after property name');
        const valueType = this.parseTypeAnnotation();
        properties.push({ key, valueType });
        
        this.match(TokenType.COMMA);
      }
      
      this.consume(TokenType.RBRACE, 'Expected }');
      return { type: 'ObjectType', properties };
    }
    
    // Type reference: Spell, Character, etc.
    if (this.check(TokenType.IDENTIFIER)) {
      const name = this.advance().value;
      return { type: 'TypeReference', name };
    }
    
    throw new Error(`Expected type annotation at line ${token.line}`);
  }
  
  // ============================================================================
  // Expressions
  // ============================================================================
  
  private expression(): ASTNode {
    return this.assignment();
  }
  
  private assignment(): ASTNode {
    const expr = this.conditional();
    
    if (this.match(TokenType.EQUALS)) {
      const value = this.assignment();
      return { type: 'AssignmentExpression', target: expr, value };
    }
    
    return expr;
  }
  
  private conditional(): ASTNode {
    const expr = this.logicalOr();
    
    if (this.match(TokenType.QUESTION)) {
      const consequent = this.expression();
      this.consume(TokenType.COLON, 'Expected : in ternary expression');
      const alternate = this.expression();
      return { type: 'ConditionalExpression', test: expr, consequent, alternate };
    }
    
    return expr;
  }
  
  private logicalOr(): ASTNode {
    let left = this.logicalAnd();
    
    while (this.match(TokenType.PIPE_PIPE)) {
      const operator = this.previous().value;
      const right = this.logicalAnd();
      left = { type: 'BinaryExpression', operator, left, right };
    }
    
    return left;
  }
  
  private logicalAnd(): ASTNode {
    let left = this.equality();
    
    while (this.match(TokenType.AMPERSAND_AMPERSAND)) {
      const operator = this.previous().value;
      const right = this.equality();
      left = { type: 'BinaryExpression', operator, left, right };
    }
    
    return left;
  }
  
  private equality(): ASTNode {
    let left = this.comparison();
    
    while (this.match(TokenType.EQUALS_EQUALS, TokenType.BANG_EQUALS)) {
      const operator = this.previous().value;
      const right = this.comparison();
      left = { type: 'BinaryExpression', operator, left, right };
    }
    
    return left;
  }
  
  private comparison(): ASTNode {
    let left = this.additive();
    
    while (this.match(TokenType.LESS, TokenType.LESS_EQUALS, TokenType.GREATER, TokenType.GREATER_EQUALS)) {
      const operator = this.previous().value;
      const right = this.additive();
      left = { type: 'BinaryExpression', operator, left, right };
    }
    
    return left;
  }
  
  private additive(): ASTNode {
    let left = this.multiplicative();
    
    while (this.match(TokenType.PLUS, TokenType.MINUS)) {
      const operator = this.previous().value;
      const right = this.multiplicative();
      left = { type: 'BinaryExpression', operator, left, right };
    }
    
    return left;
  }
  
  private multiplicative(): ASTNode {
    let left = this.unary();
    
    while (this.match(TokenType.STAR, TokenType.SLASH, TokenType.PERCENT)) {
      const operator = this.previous().value;
      const right = this.unary();
      left = { type: 'BinaryExpression', operator, left, right };
    }
    
    return left;
  }
  
  private unary(): ASTNode {
    if (this.match(TokenType.BANG, TokenType.MINUS)) {
      const operator = this.previous().value;
      const operand = this.unary();
      return { type: 'UnaryExpression', operator, operand };
    }
    
    // NEW: Handle await expression
    if (this.match(TokenType.AWAIT)) {
      const argument = this.unary();
      return { type: 'AwaitExpression', argument };
    }
    
    return this.call();
  }
  
  private call(): ASTNode {
    let expr = this.member();
    
    while (this.match(TokenType.LPAREN)) {
      const args: ASTNode[] = [];
      
      if (!this.check(TokenType.RPAREN)) {
        do {
          args.push(this.expression());
        } while (this.match(TokenType.COMMA));
      }
      
      this.consume(TokenType.RPAREN, 'Expected ) after arguments');
      expr = { type: 'CallExpression', callee: expr, arguments: args };
    }
    
    return expr;
  }
  
  private member(): ASTNode {
    let expr = this.primary();
    
    while (true) {
      if (this.match(TokenType.DOT)) {
        const property = this.consume(TokenType.IDENTIFIER, 'Expected property name').value;
        expr = { type: 'MemberExpression', object: expr, property, computed: false };
      } else if (this.match(TokenType.LBRACKET)) {
        const indexExpr = this.expression();
        this.consume(TokenType.RBRACKET, 'Expected ] after index');
        
        // Convert to computed member access
        if (indexExpr.type === 'Literal') {
          expr = { 
            type: 'MemberExpression', 
            object: expr, 
            property: String(indexExpr.value), 
            computed: true 
          };
        } else {
          // For complex expressions, we'll need to handle this differently
          throw new Error('Complex computed member access not yet supported');
        }
      } else {
        break;
      }
    }
    
    return expr;
  }
  
  private primary(): ASTNode {
    if (this.match(TokenType.TRUE)) {
      return { type: 'Literal', value: true };
    }
    
    if (this.match(TokenType.FALSE)) {
      return { type: 'Literal', value: false };
    }
    
    if (this.match(TokenType.NULL)) {
      return { type: 'Literal', value: null };
    }
    
    if (this.match(TokenType.NUMBER)) {
      return { type: 'Literal', value: parseFloat(this.previous().value) };
    }
    
    if (this.match(TokenType.STRING)) {
      return { type: 'Literal', value: this.previous().value };
    }
    
    // Check for async arrow function
    if (this.match(TokenType.ASYNC)) {
      if (this.check(TokenType.IDENTIFIER)) {
        const name = this.advance().value;
        if (this.match(TokenType.FAT_ARROW)) {
          const body = this.expression();
          return { type: 'ArrowFunction', params: [name], body, async: true };
        }
        throw new Error('Expected => after async parameter');
      }
      
      if (this.match(TokenType.LPAREN)) {
        const params: string[] = [];
        if (!this.check(TokenType.RPAREN)) {
          do {
            params.push(this.consume(TokenType.IDENTIFIER, 'Expected parameter').value);
          } while (this.match(TokenType.COMMA));
        }
        this.consume(TokenType.RPAREN, 'Expected ) after parameters');
        this.consume(TokenType.FAT_ARROW, 'Expected => after async parameters');
        const body = this.expression();
        return { type: 'ArrowFunction', params, body, async: true };
      }
      
      throw new Error('Expected identifier or ( after async');
    }
    
    if (this.match(TokenType.IDENTIFIER)) {
      const name = this.previous().value;
      
      // Arrow function: x => expr
      if (this.match(TokenType.FAT_ARROW)) {
        const body = this.expression();
        return { type: 'ArrowFunction', params: [name], body, async: false };
      }
      
      return { type: 'Identifier', name };
    }
    
    if (this.match(TokenType.LPAREN)) {
      // Could be grouped expression or arrow function params
      const startPos = this.pos;
      
      // Try to parse as arrow function
      const params: string[] = [];
      if (!this.check(TokenType.RPAREN)) {
        if (this.check(TokenType.IDENTIFIER)) {
          params.push(this.advance().value);
          
          while (this.match(TokenType.COMMA)) {
            params.push(this.consume(TokenType.IDENTIFIER, 'Expected parameter').value);
          }
        }
      }
      
      if (this.match(TokenType.RPAREN) && this.match(TokenType.FAT_ARROW)) {
        const body = this.expression();
        return { type: 'ArrowFunction', params, body, async: false };
      }
      
      // Not an arrow function, backtrack and parse as grouped expression
      this.pos = startPos;
      const expr = this.expression();
      this.consume(TokenType.RPAREN, 'Expected ) after expression');
      return expr;
    }
    
    if (this.match(TokenType.LBRACKET)) {
      const elements: ASTNode[] = [];
      
      if (!this.check(TokenType.RBRACKET)) {
        do {
          elements.push(this.expression());
        } while (this.match(TokenType.COMMA));
      }
      
      this.consume(TokenType.RBRACKET, 'Expected ] after array elements');
      return { type: 'ArrayExpression', elements };
    }
    
    if (this.match(TokenType.LBRACE)) {
      const properties: { key: string; value: ASTNode }[] = [];
      
      if (!this.check(TokenType.RBRACE)) {
        do {
          const key = this.consume(TokenType.IDENTIFIER, 'Expected property key').value;
          this.consume(TokenType.COLON, 'Expected : after property key');
          const value = this.expression();
          properties.push({ key, value });
        } while (this.match(TokenType.COMMA));
      }
      
      this.consume(TokenType.RBRACE, 'Expected } after object properties');
      return { type: 'ObjectExpression', properties };
    }
    
    throw new Error(`Unexpected token: ${this.peek().type} at line ${this.peek().line}`);
  }
  
  // ============================================================================
  // Utility Methods
  // ============================================================================
  
  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }
  
  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }
  
  private advance(): Token {
    if (!this.isAtEnd()) this.pos++;
    return this.previous();
  }
  
  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }
  
  private peek(): Token {
    return this.tokens[this.pos];
  }
  
  private previous(): Token {
    return this.tokens[this.pos - 1];
  }
  
  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw new Error(`${message} at line ${this.peek().line}, got ${this.peek().type}`);
  }
}