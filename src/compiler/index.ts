// ============================================================================
// MAIN COMPILER API
// ============================================================================

import CodeGenerator from "./code-generator";
import Lexer from "./lexer";
import Parser from "./parser";
import TypeChecker, { Type } from "./type-checker";
export interface CompileResult {
  success: boolean;
  returnType?: string;
  code?: string;
  error?: string;
}

export default class VerseScriptCompiler {
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
