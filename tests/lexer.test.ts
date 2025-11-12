import { describe, it, expect } from 'vitest';
import { Lexer, TokenType } from '../src/compiler/lexer';

describe('Lexer', () => {
  it('should tokenize numbers', () => {
    const lexer = new Lexer('42 3.14');
    const tokens = lexer.tokenize();
    
    expect(tokens[0].type).toBe(TokenType.NUMBER);
    expect(tokens[0].value).toBe('42');
    expect(tokens[1].type).toBe(TokenType.NUMBER);
    expect(tokens[1].value).toBe('3.14');
  });
  
  it('should tokenize strings', () => {
    const lexer = new Lexer('"hello" \'world\'');
    const tokens = lexer.tokenize();
    
    expect(tokens[0].type).toBe(TokenType.STRING);
    expect(tokens[0].value).toBe('hello');
    expect(tokens[1].type).toBe(TokenType.STRING);
    expect(tokens[1].value).toBe('world');
  });
  
  it('should tokenize keywords', () => {
    const lexer = new Lexer('let const if else for return fn');
    const tokens = lexer.tokenize();
    
    expect(tokens[0].type).toBe(TokenType.LET);
    expect(tokens[1].type).toBe(TokenType.CONST);
    expect(tokens[2].type).toBe(TokenType.IF);
    expect(tokens[3].type).toBe(TokenType.ELSE);
    expect(tokens[4].type).toBe(TokenType.FOR);
    expect(tokens[5].type).toBe(TokenType.RETURN);
    expect(tokens[6].type).toBe(TokenType.FN);
  });
  
  it('should tokenize operators', () => {
    const lexer = new Lexer('+ - * / == != <= >= && ||');
    const tokens = lexer.tokenize();
    
    expect(tokens[0].type).toBe(TokenType.PLUS);
    expect(tokens[1].type).toBe(TokenType.MINUS);
    expect(tokens[2].type).toBe(TokenType.STAR);
    expect(tokens[3].type).toBe(TokenType.SLASH);
    expect(tokens[4].type).toBe(TokenType.EQUALS_EQUALS);
    expect(tokens[5].type).toBe(TokenType.BANG_EQUALS);
    expect(tokens[6].type).toBe(TokenType.LESS_EQUALS);
    expect(tokens[7].type).toBe(TokenType.GREATER_EQUALS);
    expect(tokens[8].type).toBe(TokenType.AMPERSAND_AMPERSAND);
    expect(tokens[9].type).toBe(TokenType.PIPE_PIPE);
  });
  
  it('should skip comments', () => {
    const lexer = new Lexer('let x = 5 // this is a comment\nlet y = 10');
    const tokens = lexer.tokenize();
    
    // Should skip the comment
    const identifiers = tokens.filter((t: any) => t.type === TokenType.IDENTIFIER);
    expect(identifiers.length).toBe(2);
    expect(identifiers[0].value).toBe('x');
    expect(identifiers[1].value).toBe('y');
  });
});