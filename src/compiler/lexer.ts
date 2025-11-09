// ============================================================================
// LEXER - Tokenizes source code
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
  ARROW = 'ARROW',
  
  // Special
  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export default class Lexer {
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
        return { type: TokenType.ARROW, value: '=>', line: this.line, column: startColumn };
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
    
    if (char === '&' && this.peek() === '&') {
      this.advance();
      this.advance();
      return { type: TokenType.AMPERSAND_AMPERSAND, value: '&&', line: this.line, column: startColumn };
    }
    
    if (char === '|' && this.peek() === '|') {
      this.advance();
      this.advance();
      return { type: TokenType.PIPE_PIPE, value: '||', line: this.line, column: startColumn };
    }
    
    if (char === '-') {
      this.advance();
      if (this.isDigit(this.peek())) {
        return this.scanNumber(true);
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
      'true': TokenType.TRUE,
      'false': TokenType.FALSE,
      'null': TokenType.NULL,
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

// ============================================================================
// EXAMPLE USAGE
// ============================================================================

// Define your TTRPG types
// const SpellType = TTRPGScriptCompiler.createObjectType('Spell', {
//   name: BUILTIN_TYPES.string,
//   level: BUILTIN_TYPES.number,
//   damage: BUILTIN_TYPES.string,
// });

// const SpellSlotType = TTRPGScriptCompiler.createObjectType('SpellSlot', {
//   level: BUILTIN_TYPES.number,
//   current: BUILTIN_TYPES.number,
//   max: BUILTIN_TYPES.number,
// });

// const SpellCastingType = TTRPGScriptCompiler.createObjectType('SpellCasting', {
//   name: BUILTIN_TYPES.string,
//   slots: TTRPGScriptCompiler.createArrayType(SpellSlotType),
//   spells: TTRPGScriptCompiler.createArrayType(SpellType),
// });

// const CharacterStateType = TTRPGScriptCompiler.createObjectType('CharacterState', {
//   hp: BUILTIN_TYPES.number,
//   maxHp: BUILTIN_TYPES.number,
//   spellCastings: TTRPGScriptCompiler.createArrayType(SpellCastingType),
// });

// // Create compiler with context
// const compiler = new TTRPGScriptCompiler({
//   characterState: CharacterStateType,
//   casting: SpellCastingType,
//   slot: SpellSlotType,
// });

// // Example 1: Dynamic list that returns Spell[]
// const script1 = `
// const filtered = characterState.spells.filter(s => s.level <= 3)
// return filtered
// `;

// console.log('Example 1 - Filter spells:');
// const result1 = compiler.compile(script1);
// console.log('Return Type:', result1.returnType); // Should be "Spell[]" or "unknown[]"
// console.log('Generated Code:', result1.code);
// console.log('---\n');

// // Example 2: Dynamic list with nested context
// const script2 = `
// const spells = casting.spells.filter(s => s.level == slot.level)
// return spells
// `;

// console.log('Example 2 - Nested context:');
// const result2 = compiler.compile(script2);
// console.log('Return Type:', result2.returnType);
// console.log('Generated Code:', result2.code);
// console.log('---\n');

// // Example 3: Complex logic with conditional returns
// const script3 = `
// if slot.current <= 0 {
//   return null
// }

// const availableSpells = casting.spells.filter(s => s.level == slot.level)
// return availableSpells
// `;

// console.log('Example 3 - Conditional return:');
// const result3 = compiler.compile(script3);
// console.log('Return Type:', result3.returnType); // Should be "Spell[] | null"
// console.log('Generated Code:', result3.code);
// console.log('---\n');

// // Example 4: Function with return type inference
// const script4 = `
// fn getSpellsForLevel(castingName, level) {
//   const casting = characterState.spellCastings.find(c => c.name == castingName)
//   if casting == null {
//     return []
//   }
//   return casting.spells.filter(s => s.level <= level)
// }

// return getSpellsForLevel("Cleric", 3)
// `;

// console.log('Example 4 - Function with inference:');
// const result4 = compiler.compile(script4);
// console.log('Return Type:', result4.returnType);
// console.log('Generated Code:', result4.code);
// console.log('---\n');