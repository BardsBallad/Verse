// ============================================================================
// Monaco Language Service for TTRPG Script Language
// ============================================================================

import * as monaco from 'monaco-editor';
import VerseScriptCompiler, { Type } from '../compiler';

export interface CompletionContext {
  types: Map<string, Type>;
  currentScope: string[];
}

export class TTRPGScriptLanguageService {
  private compiler: VerseScriptCompiler;
  private disposables: monaco.IDisposable[] = [];
  
  constructor(contextTypes?: Record<string, Type>) {
    this.compiler = new VerseScriptCompiler(contextTypes);
  }
  
  /**
   * Register the language with Monaco
   */
  register() {
    // Register language
    monaco.languages.register({ id: 'verse' });
    
    // Set up syntax highlighting
    this.registerTokensProvider();
    
    // Set up language features
    this.registerCompletionProvider();
    this.registerHoverProvider();
    this.registerDiagnosticsProvider();
    
    return this;
  }
  
  /**
   * Dispose all Monaco registrations
   */
  dispose() {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
  
  /**
   * Register syntax highlighting
   */
  private registerTokensProvider() {
    this.disposables.push(
      monaco.languages.setMonarchTokensProvider('verse', {
        keywords: [
          'let', 'const', 'if', 'else', 'for', 'in', 'return', 'fn', 
          'type', 'interface', 'true', 'false', 'null'
        ],
        
        typeKeywords: [
          'number', 'string', 'boolean', 'null', 'unknown'
        ],
        
        operators: [
          '=', '>', '<', '!', '==', '<=', '>=', '!=',
          '&&', '||', '+', '-', '*', '/', '%', '=>', '?', ':'
        ],
        
        symbols: /[=><!~?:&|+\-*/^%]+/,
        
        tokenizer: {
          root: [
            // Identifiers and keywords
            [/[a-zA-Z_]\w*/, {
              cases: {
                '@typeKeywords': 'type',
                '@keywords': 'keyword',
                '@default': 'identifier'
              }
            }],
            
            // Numbers
            [/\d+(\.\d+)?/, 'number'],
            
            // Strings
            [/"([^"\\]|\\.)*$/, 'string.invalid'],
            [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
            [/'([^'\\]|\\.)*$/, 'string.invalid'],
            [/'/, { token: 'string.quote', bracket: '@open', next: '@string_single' }],
            
            // Operators
            [/@symbols/, {
              cases: {
                '@operators': 'operator',
                '@default': ''
              }
            }],
            
            // Comments
            [/\/\/.*$/, 'comment'],
            
            // Delimiters
            [/[{}()[\]]/, '@brackets'],
            [/[,.]/, 'delimiter'],
          ],
          
          string: [
            [/[^\\"]+/, 'string'],
            [/\\./, 'string.escape'],
            [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
          ],
          
          string_single: [
            [/[^\\']+/, 'string'],
            [/\\./, 'string.escape'],
            [/'/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
          ],
        }
      })
    );
  }
  
  /**
   * Register autocomplete provider
   */
  private registerCompletionProvider() {
    this.disposables.push(
      monaco.languages.registerCompletionItemProvider('verse', {
        triggerCharacters: ['.'],
        
        provideCompletionItems: (model, position) => {
          const textUntilPosition = model.getValueInRange({
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          });
          
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };
          
          // Check if we're after a dot (property access)
          const beforeDot = textUntilPosition.slice(0, -1).trim();
          const lastDotIndex = beforeDot.lastIndexOf('.');
          
          if (lastDotIndex > 0) {
            // We're accessing a property
            return this.getPropertyCompletions(beforeDot, lastDotIndex, range);
          }
          
          // Top-level completions
          return this.getTopLevelCompletions(range);
        },
      })
    );
  }
  
  /**
   * Get completions for property access (obj.???)
   */
  private getPropertyCompletions(
    text: string,
    dotIndex: number,
    range: monaco.IRange
  ): monaco.languages.CompletionList {
    const suggestions: monaco.languages.CompletionItem[] = [];
    
    // Extract the object path before the dot
    const objectPath = text.slice(0, dotIndex).trim();
    
    // Try to infer the type of the object
    try {
      const tempCode = `return ${objectPath}`;
      const result = this.compiler.compile(tempCode);
      
      if (result.success && result.returnType) {
        // Parse the type and get its properties
        const properties = this.getPropertiesFromType(result.returnType);
        
        for (const [propName, propType] of Object.entries(properties)) {
          suggestions.push({
            label: propName,
            kind: monaco.languages.CompletionItemKind.Property,
            detail: propType,
            insertText: propName,
            range,
          });
        }
      }
    } catch (error) {
      // If we can't infer, provide common array methods
      if (objectPath.includes('[') || text.includes('filter') || text.includes('map')) {
        const arrayMethods = [
          { name: 'filter', detail: 'Filter array elements', snippet: 'filter(${1:item} => ${2:condition})' },
          { name: 'map', detail: 'Transform array elements', snippet: 'map(${1:item} => ${2:transformation})' },
          { name: 'find', detail: 'Find first matching element', snippet: 'find(${1:item} => ${2:condition})' },
          { name: 'some', detail: 'Check if any element matches', snippet: 'some(${1:item} => ${2:condition})' },
          { name: 'every', detail: 'Check if all elements match', snippet: 'every(${1:item} => ${2:condition})' },
          { name: 'length', detail: 'Array length', snippet: 'length' },
        ];
        
        for (const method of arrayMethods) {
          suggestions.push({
            label: method.name,
            kind: monaco.languages.CompletionItemKind.Method,
            detail: method.detail,
            insertText: method.snippet,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          });
        }
      }
    }
    
    return { suggestions };
  }
  
  /**
   * Get top-level completions (keywords, context variables)
   */
  private getTopLevelCompletions(range: monaco.IRange): monaco.languages.CompletionList {
    const suggestions: monaco.languages.CompletionItem[] = [
      // Keywords
      {
        label: 'let',
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: 'let ${1:name} = ${2:value}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Declare a variable',
        range,
      },
      {
        label: 'const',
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: 'const ${1:name} = ${2:value}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Declare a constant',
        range,
      },
      {
        label: 'if',
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: 'if ${1:condition} {\n  ${2}\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'If statement',
        range,
      },
      {
        label: 'for',
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: 'for ${1:item} in ${2:array} {\n  ${3}\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'For loop',
        range,
      },
      {
        label: 'fn',
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: 'fn ${1:name}(${2:params}) {\n  ${3}\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Function declaration',
        range,
      },
      {
        label: 'return',
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: 'return ${1:value}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Return statement',
        range,
      },
      
      // Context variables (these would come from your compiler's context)
      {
        label: 'characterState',
        kind: monaco.languages.CompletionItemKind.Variable,
        detail: 'CharacterState',
        insertText: 'characterState',
        documentation: 'Character state data',
        range,
      },
      {
        label: 'casting',
        kind: monaco.languages.CompletionItemKind.Variable,
        detail: 'SpellCasting',
        insertText: 'casting',
        documentation: 'Current spell casting',
        range,
      },
      {
        label: 'slot',
        kind: monaco.languages.CompletionItemKind.Variable,
        detail: 'SpellSlot',
        insertText: 'slot',
        documentation: 'Current spell slot',
        range,
      },
    ];
    
    return { suggestions };
  }
  
  /**
   * Extract properties from a type string
   */
  private getPropertiesFromType(typeStr: string): Record<string, string> {
    // This is a simplified parser - in production you'd use your type system
    const properties: Record<string, string> = {};
    
    // Handle known types
    const typeMap: Record<string, Record<string, string>> = {
      'CharacterState': {
        'hp': 'number',
        'maxHp': 'number',
        'level': 'number',
        'spellCastings': 'SpellCasting[]',
      },
      'SpellCasting': {
        'name': 'string',
        'slots': 'SpellSlot[]',
        'spells': 'Spell[]',
      },
      'SpellSlot': {
        'level': 'number',
        'current': 'number',
        'max': 'number',
      },
      'Spell': {
        'name': 'string',
        'level': 'number',
        'damage': 'string',
      },
    };
    
    // Extract type name (handle arrays)
    const baseType = typeStr.replace('[]', '');
    
    if (typeMap[baseType]) {
      return typeMap[baseType];
    }
    
    // For arrays, provide array methods
    if (typeStr.endsWith('[]')) {
      return {
        'filter': 'method',
        'map': 'method',
        'find': 'method',
        'length': 'number',
      };
    }
    
    return properties;
  }
  
  /**
   * Register hover provider (show type info on hover)
   */
  private registerHoverProvider() {
    this.disposables.push(
      monaco.languages.registerHoverProvider('ttrpgscript', {
        provideHover: (model, position) => {
          const word = model.getWordAtPosition(position);
          if (!word) return null;
          
          // Try to get type info for the identifier
          const lineContent = model.getLineContent(position.lineNumber);
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const beforeWord = lineContent.slice(0, word.startColumn - 1);
          
          // Check if this is a variable we can infer
          try {
            const code = model.getValue();
            const result = this.compiler.compile(code);
            
            if (result.success) {
              return {
                range: new monaco.Range(
                  position.lineNumber,
                  word.startColumn,
                  position.lineNumber,
                  word.endColumn
                ),
                contents: [
                  { value: `**${word.word}**` },
                  { value: `Type: \`${result.returnType || 'unknown'}\`` },
                ],
              };
            }
          } catch (error) {
            // Ignore hover errors
          }
          
          return null;
        },
      })
    );
  }
  
  /**
   * Register diagnostics provider (real-time error checking)
   */
  private registerDiagnosticsProvider() {
    // This gets called whenever the model changes
    const updateDiagnostics = (model: monaco.editor.ITextModel) => {
      const code = model.getValue();
      const result = this.compiler.compile(code);
      
      const markers: monaco.editor.IMarkerData[] = [];
      
      if (!result.success && result.error) {
        // Parse error message to get line number if possible
        const errorMatch = result.error.match(/line (\d+)/);
        const line = errorMatch ? parseInt(errorMatch[1]) : 1;
        
        markers.push({
          severity: monaco.MarkerSeverity.Error,
          startLineNumber: line,
          startColumn: 1,
          endLineNumber: line,
          endColumn: 1000,
          message: result.error,
        });
      }
      
      monaco.editor.setModelMarkers(model, 'ttrpgscript', markers);
    };
    
    // Update diagnostics on model change
    monaco.editor.onDidCreateModel((model) => {
      if (model.getLanguageId() === 'ttrpgscript') {
        updateDiagnostics(model);
        
        model.onDidChangeContent(() => {
          updateDiagnostics(model);
        });
      }
    });
  }
  
  /**
   * Get compilation result for current code
   */
  compile(code: string) {
    return this.compiler.compile(code);
  }
}

// ============================================================================
// Helper: Create editor with language service
// ============================================================================

export function createTTRPGScriptEditor(
  container: HTMLElement,
  contextTypes?: Record<string, Type>,
  initialValue?: string
): {
  editor: monaco.editor.IStandaloneCodeEditor;
  languageService: TTRPGScriptLanguageService;
} {
  // Create and register language service
  const languageService = new TTRPGScriptLanguageService(contextTypes);
  languageService.register();
  
  // Create editor
  const editor = monaco.editor.create(container, {
    value: initialValue || '',
    language: 'ttrpgscript',
    theme: 'vs-dark',
    automaticLayout: true,
    fontSize: 14,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    padding: { top: 10, bottom: 10 },
    suggestOnTriggerCharacters: true,
    quickSuggestions: {
      other: true,
      comments: false,
      strings: false,
    },
  });
  
  return { editor, languageService };
}

// ============================================================================
// Example Usage
// ============================================================================

/*
import { createTTRPGScriptEditor, TTRPGScriptCompiler } from './monaco-integration';

// Define your types
const SpellType = TTRPGScriptCompiler.createObjectType('Spell', {
  name: BUILTIN_TYPES.string,
  level: BUILTIN_TYPES.number,
  damage: BUILTIN_TYPES.string,
});

const contextTypes = {
  characterState: CharacterStateType,
  casting: SpellCastingType,
  slot: SpellSlotType,
};

// Create editor
const { editor, languageService } = createTTRPGScriptEditor(
  document.getElementById('editor'),
  contextTypes,
  'return casting.spells.filter(s => s.level <= 2)'
);

// Get compilation results
editor.onDidChangeModelContent(() => {
  const code = editor.getValue();
  const result = languageService.compile(code);
  
  if (result.success) {
    console.log('Return type:', result.returnType);
    console.log('Compiled code:', result.code);
  }
});
*/