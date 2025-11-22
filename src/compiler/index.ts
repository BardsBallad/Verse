// ============================================================================
// MAIN COMPILER API
// ============================================================================

import { CodeGenerator } from "./code-generator";
import { Lexer } from "./lexer";
import { Parser } from "./parser";
import { TypeChecker, Type } from "./type-checker";
import type { ASTNode } from './ast';
export interface CompileResult {
  success: boolean;
  returnType?: string;
  code?: string;
  error?: string;
}

export class VerseScriptCompiler {
  private typeChecker: TypeChecker;
  
  constructor(contextTypes?: Record<string, Type>) {
    this.typeChecker = new TypeChecker(contextTypes);
  }
  
  registerType(name: string, type: Type) {
    this.typeChecker.registerType(name, type);
  }

  registerFunction(name: string, params: Type[], returnType: Type, isAsync: boolean = false) {
    this.typeChecker.registerFunction(name, params, returnType, isAsync);
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
      
      // Annotate inline object expressions with inferred type name when possible
      // so the code generator can inject `_type` for inline literals.
      const annotate = (node: ASTNode | unknown) => {
        if (!node || typeof node !== 'object') return;
        const anyNode = node as ASTNode;
        if (anyNode.type === 'ObjectExpression') {
          try {
            const t = this.typeChecker.inferExpression(anyNode);
            if (t && t.kind === 'object' && t.name) {
              (anyNode as unknown as Record<string, unknown>).__inferredTypeName = t.name;
            }
          } catch (e) {
            // ignore inference errors for inline annotation
          }
        }
        // recurse
        for (const key of Object.keys(node as Record<string, unknown>)) {
          const child = (node as Record<string, unknown>)[key];
          if (Array.isArray(child)) {
            child.forEach(c => annotate(c));
          } else if (child && typeof child === 'object') {
            annotate(child);
          }
        }
      };

      annotate(ast);
      
      // Code generation (pass through code generator options if provided)
      const generator = new CodeGenerator();
      const code = generator.generate(ast);
      
      return {
        success: true,
        returnType: returnTypeStr,
        code,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: msg,
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
