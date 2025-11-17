// ============================================================================
// LEXER - Tokenizes source code with Async/Await support
// ============================================================================

export enum TokenType {
  // Literals
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  TRUE = 'TRUE',
  FALSE = 'FALSE',
  NULL = 'NULL',
  
  // Identifiers and Keywords
  IDENTIFIER = 'IDENTIFIER',
  LET = 'LET',
  CONST = 'CONST',
  IF = 'IF',
  ELSE = 'ELSE',
  FOR = 'FOR',
  IN = 'IN',
  RETURN = 'RETURN',
  FN = 'FN',
  TYPE = 'TYPE',
  INTERFACE = 'INTERFACE',
  ASYNC = 'ASYNC',
  AWAIT = 'AWAIT',
  
  // Operators
  PLUS = 'PLUS',
  MINUS = 'MINUS',
  STAR = 'STAR',
  SLASH = 'SLASH',
  PERCENT = 'PERCENT',
  EQUALS = 'EQUALS',
  EQUALS_EQUALS = 'EQUALS_EQUALS',
  BANG_EQUALS = 'BANG_EQUALS',
  LESS = 'LESS',
  LESS_EQUALS = 'LESS_EQUALS',
  GREATER = 'GREATER',
  GREATER_EQUALS = 'GREATER_EQUALS',
  AMPERSAND_AMPERSAND = 'AMPERSAND_AMPERSAND',
  PIPE_PIPE = 'PIPE_PIPE',
  BANG = 'BANG',
  QUESTION = 'QUESTION',
  
  // Delimiters
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  LBRACE = 'LBRACE',
  RBRACE = 'RBRACE',
  LBRACKET = 'LBRACKET',
  RBRACKET = 'RBRACKET',
  COMMA = 'COMMA',
  DOT = 'DOT',
  COLON = 'COLON',
  RETURN_ARROW = 'RETURN_ARROW',
  FAT_ARROW = 'FAT_ARROW',
  PIPE = 'PIPE',
  
  // Special
  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export class Lexer {
  private source: string;
  private pos = 0;
  private line = 1;
  private column = 1;
  
  constructor(source: string) {
    this.source = source;
  }
  
  tokenize(): Token[] {
    const tokens: Token[] = [];
    
    while (this.pos < this.source.length) {
      this.skipWhitespace();
      if (this.pos >= this.source.length) break;
      
      const token = this.nextToken();
      if (token) tokens.push(token);
    }
    
    tokens.push({ type: TokenType.EOF, value: '', line: this.line, column: this.column });
    return tokens;
  }
  
  private nextToken(): Token | null {
    const start = this.pos;
    const startColumn = this.column;
    const char = this.source[start];
    
    // Single character tokens
    const singleChar: Record<string, TokenType> = {
      '(': TokenType.LPAREN,
      ')': TokenType.RPAREN,
      '{': TokenType.LBRACE,
      '}': TokenType.RBRACE,
      '[': TokenType.LBRACKET,
      ']': TokenType.RBRACKET,
      ',': TokenType.COMMA,
      '.': TokenType.DOT,
      ':': TokenType.COLON,
      '+': TokenType.PLUS,
      '*': TokenType.STAR,
      '/': TokenType.SLASH,
      '%': TokenType.PERCENT,
      '?': TokenType.QUESTION,
    };
    
    if (singleChar[char]) {
      this.advance();
      return { type: singleChar[char], value: char, line: this.line, column: startColumn };
    }
    
    // Two character tokens
    if (char === '=') {
      this.advance();
      if (this.peek() === '=') {
        this.advance();
        return { type: TokenType.EQUALS_EQUALS, value: '==', line: this.line, column: startColumn };
      }
      if (this.peek() === '>') {
        this.advance();
        return { type: TokenType.FAT_ARROW, value: '=>', line: this.line, column: startColumn };
      }
      return { type: TokenType.EQUALS, value: '=', line: this.line, column: startColumn };
    }
    
    if (char === '!') {
      this.advance();
      if (this.peek() === '=') {
        this.advance();
        return { type: TokenType.BANG_EQUALS, value: '!=', line: this.line, column: startColumn };
      }
      return { type: TokenType.BANG, value: '!', line: this.line, column: startColumn };
    }
    
    if (char === '<') {
      this.advance();
      if (this.peek() === '=') {
        this.advance();
        return { type: TokenType.LESS_EQUALS, value: '<=', line: this.line, column: startColumn };
      }
      return { type: TokenType.LESS, value: '<', line: this.line, column: startColumn };
    }
    
    if (char === '>') {
      this.advance();
      if (this.peek() === '=') {
        this.advance();
        return { type: TokenType.GREATER_EQUALS, value: '>=', line: this.line, column: startColumn };
      }
      return { type: TokenType.GREATER, value: '>', line: this.line, column: startColumn };
    }
    
    if (char === '&') {
      this.advance()
      if (this.peek() === '&') {
        this.advance();
        return { type: TokenType.AMPERSAND_AMPERSAND, value: '&&', line: this.line, column: startColumn };
      }
      this.backup()
    }
    
    if (char === '|') {
      this.advance()
      if (this.peek() === '|') {
        this.advance();
        return { type: TokenType.PIPE_PIPE, value: '||', line: this.line, column: startColumn };
      }
      return { type: TokenType.PIPE, value: '|', line: this.line, column: startColumn };
    }
    
    if (char === '-') {
      this.advance();
      if (this.isDigit(this.peek())) {
        return this.scanNumber(true);
      }
      if (this.peek() === '>') {
        this.advance();
        return { type: TokenType.RETURN_ARROW, value: '->', line: this.line, column: startColumn };
      }
      return { type: TokenType.MINUS, value: '-', line: this.line, column: startColumn };
    }
    
    // Strings
    if (char === '"' || char === "'") {
      return this.scanString(char);
    }
    
    // Numbers
    if (this.isDigit(char)) {
      return this.scanNumber();
    }
    
    // Identifiers and keywords
    if (this.isAlpha(char)) {
      return this.scanIdentifier();
    }
    
    throw new Error(`Unexpected character '${char}' at line ${this.line}, column ${this.column}`);
  }
  
  private scanString(quote: string): Token {
    const startColumn = this.column;
    this.advance(); // consume opening quote
    
    let value = '';
    while (this.pos < this.source.length && this.source[this.pos] !== quote) {
      if (this.source[this.pos] === '\\') {
        this.advance();
        const escaped = this.source[this.pos];
        value += escaped === 'n' ? '\n' : escaped === 't' ? '\t' : escaped;
      } else {
        value += this.source[this.pos];
      }
      this.advance();
    }
    
    if (this.pos >= this.source.length) {
      throw new Error(`Unterminated string at line ${this.line}`);
    }
    
    this.advance(); // consume closing quote
    return { type: TokenType.STRING, value, line: this.line, column: startColumn };
  }
  
  private scanNumber(negative = false): Token {
    const startColumn = this.column;
    let value = negative ? '-' : '';
    
    while (this.isDigit(this.peek())) {
      value += this.source[this.pos];
      this.advance();
    }
    
    if (this.peek() === '.' && this.isDigit(this.source[this.pos + 1])) {
      value += this.source[this.pos];
      this.advance();
      
      while (this.isDigit(this.peek())) {
        value += this.source[this.pos];
        this.advance();
      }
    }
    
    return { type: TokenType.NUMBER, value, line: this.line, column: startColumn };
  }
  
  private scanIdentifier(): Token {
    const startColumn = this.column;
    let value = '';
    
    while (this.isAlphaNumeric(this.peek())) {
      value += this.source[this.pos];
      this.advance();
    }
    
    const keywords: Record<string, TokenType> = {
      'let': TokenType.LET,
      'const': TokenType.CONST,
      'if': TokenType.IF,
      'else': TokenType.ELSE,
      'for': TokenType.FOR,
      'in': TokenType.IN,
      'return': TokenType.RETURN,
      'fn': TokenType.FN,
      'type': TokenType.TYPE,
      'interface': TokenType.INTERFACE,
      'true': TokenType.TRUE,
      'false': TokenType.FALSE,
      'null': TokenType.NULL,
      'async': TokenType.ASYNC,   // NEW
      'await': TokenType.AWAIT,   // NEW
    };
    
    const type = keywords[value] || TokenType.IDENTIFIER;
    return { type, value, line: this.line, column: startColumn };
  }
  
  private skipWhitespace() {
    while (this.pos < this.source.length) {
      const char = this.source[this.pos];
      if (char === ' ' || char === '\t' || char === '\r') {
        this.advance();
      } else if (char === '\n') {
        this.advance();
        this.line++;
        this.column = 1;
      } else if (char === '/' && this.source[this.pos + 1] === '/') {
        // Skip line comment
        while (this.pos < this.source.length && this.source[this.pos] !== '\n') {
          this.advance();
        }
      } else {
        break;
      }
    }
  }
  
  private peek(): string {
    return this.source[this.pos] || '';
  }

  private backup() {
    this.pos--;
    this.column--;
  }
  
  private advance() {
    this.pos++;
    this.column++;
  }
  
  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }
  
  private isAlpha(char: string): boolean {
    return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char === '_';
  }
  
  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char);
  }
}