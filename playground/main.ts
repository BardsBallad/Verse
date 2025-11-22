// ============================================================================
// playground/main.ts
// ============================================================================
import * as monaco from 'monaco-editor';
// @ts-expect-error this file does exist.
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import { VerseScriptCompiler, CompileResult } from '../src';

import { Scope } from 'quickjs-emscripten'
import { load } from './quick';
import { BUILTIN_TYPES } from '../src/compiler/type-checker';

// Setup Monaco workers
self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker()
  },
};

// Sample context data
const sampleContext: Record<string, unknown> = {
  character: {
    hp: 45,
    maxHp: 60,
    level: 5,
    stats: [{name: "Strength", score: 10}],
    spellCastings: [
      {
        name: "Cleric",
        slots: [
          { level: 1, current: 3, max: 4 },
          { level: 2, current: 2, max: 3 },
          { level: 3, current: 1, max: 2 }
        ],
        spells: [
          { name: "Cure Wounds", level: 1, damage: "1d8" },
          { name: "Bless", level: 1, damage: "" },
          { name: "Spiritual Weapon", level: 2, damage: "1d8+3" },
          { name: "Revivify", level: 3, damage: "" }
        ]
      },
      {
        name: "Wizard",
        slots: [
          { level: 1, current: 4, max: 4 },
          { level: 2, current: 3, max: 3 }
        ],
        spells: [
          { name: "Magic Missile", level: 1, damage: "1d4+1" },
          { name: "Shield", level: 1, damage: "" },
          { name: "Misty Step", level: 2, damage: "" }
        ]
      }
    ]
  },
  casting: {
    name: "Cleric",
    slots: [
      { level: 1, current: 3, max: 4 },
      { level: 2, current: 2, max: 3 },
      { level: 3, current: 1, max: 2 }
    ],
    spells: [
      { name: "Cure Wounds", level: 1, damage: "1d8" },
      { name: "Bless", level: 1, damage: "" },
      { name: "Spiritual Weapon", level: 2, damage: "1d8+3" },
      { name: "Revivify", level: 3, damage: "" }
    ]
  },
  slot: { level: 2, current: 2, max: 3 }
};

// Example scripts
const examples = [
  {
    title: "Type Declarations",
    desc: "Define custom types and interfaces",
    code: `// Define custom types
type SpellLevel = number
type DamageType = string | null

interface Spell {
  name: string,
  level: SpellLevel,
  damage: DamageType
}

// Use the types
const spell: Spell = casting.spells[0]
return spell`
  },
  {
    title: "Typed Variables",
    desc: "Variables with explicit type annotations",
    code: `// Variable with type annotation
const level: number = 2
const filtered: Spell[] = casting.spells.filter(s => s.level <= level)
return filtered`
  },
  {
    title: "Typed Functions",
    desc: "Functions with parameter and return types",
    code: `// Function with type annotations
fn getSpellsAtLevel(level: number) -> Spell[] {
  const spells: Spell[] = casting.spells.filter(s => s.level == level)
  return spells
}

return getSpellsAtLevel(2)`
  },
  {
    title: "Union Types",
    desc: "Handle multiple possible types",
    code: `// Function with union return type
fn findSpell(name: string) -> Spell | null {
  const found: Spell | null = casting.spells.find(s => s.name == name)
  return found
}

const result: Spell | null = findSpell("Fireball")
return result`
  },
  {
    title: "Filter Spells by Level",
    desc: "Returns spells at or below level 2",
    code: `// Filter spells by level
const filtered = casting.spells.filter(s => s.level <= 2)
return filtered`
  },
  {
    title: "Nested Context Access",
    desc: "Access parent scope variables",
    code: `// Get spells for current slot level
const spells = casting.spells.filter(s => s.level == slot.level)
return spells`
  },
  {
    title: "Conditional Returns",
    desc: "Different return types based on condition",
    code: `// Check if spell slots available
if slot.current <= 0 {
  return null
}

const available = casting.spells.filter(s => s.level == slot.level)
return available`
  },
  {
    title: "HP Calculation",
    desc: "Calculate HP percentage",
    code: `// Calculate HP percentage
const hpPercent = (characterState.hp / characterState.maxHp) * 100
return hpPercent`
  }
];

// Define TTRPG types
const SpellType = VerseScriptCompiler.createObjectType('Spell', {
  name: BUILTIN_TYPES.string,
  level: BUILTIN_TYPES.number,
  damage: BUILTIN_TYPES.string,
});

const SpellSlotType = VerseScriptCompiler.createObjectType('SpellSlot', {
  level: BUILTIN_TYPES.number,
  current: BUILTIN_TYPES.number,
  max: BUILTIN_TYPES.number,
});

const SpellCastingType = VerseScriptCompiler.createObjectType('SpellCasting', {
  name: BUILTIN_TYPES.string,
  slots: VerseScriptCompiler.createArrayType(SpellSlotType),
  spells: VerseScriptCompiler.createArrayType(SpellType),
});

const CharacterStateType = VerseScriptCompiler.createObjectType('CharacterState', {
  hp: BUILTIN_TYPES.number,
  maxHp: BUILTIN_TYPES.number,
  level: BUILTIN_TYPES.number,
  spellCastings: VerseScriptCompiler.createArrayType(SpellCastingType),
});

// Helper for required elements (throws if not present)
function getRequiredEl<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

// Initialize playground globals UI values
const globalsTextarea = document.getElementById('globalsJson') as HTMLTextAreaElement | null;
const globalGetInput = document.getElementById('globalGetName') as HTMLInputElement | null;
const globalSetInput = document.getElementById('globalSetName') as HTMLInputElement | null;

if (globalsTextarea) globalsTextarea.value = JSON.stringify(sampleContext, null, 2);
if (globalGetInput) globalGetInput.value = 'getValue';
if (globalSetInput) globalSetInput.value = 'setValue';

// Create compiler with generator global hooks from UI (use defaults if inputs not present)
let compiler = new VerseScriptCompiler({
  characterState: CharacterStateType,
  casting: SpellCastingType,
  slot: SpellSlotType,
});

compiler.registerType('spell', SpellType);

// Apply globals button wiring (recreate compiler if getter/setter names changed)
const applyBtn = document.getElementById('applyGlobalsBtn');
if (applyBtn) {
  applyBtn.addEventListener('click', () => {
      try {
        if (globalsTextarea) {
          const parsed = JSON.parse(globalsTextarea.value) as Record<string, unknown>;
          // update sampleContext in-place
          Object.keys(sampleContext).forEach(k => delete sampleContext[k]);
          Object.assign(sampleContext, parsed);
        }

        // recreate compiler with new options so generated code uses updated function names
        compiler = new VerseScriptCompiler({
          characterState: CharacterStateType,
          casting: SpellCastingType,
          slot: SpellSlotType,
        });

        compiler.registerType('spell', SpellType);

        // recompile to update compiled code preview
        compileAndAnalyze();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        alert('Invalid globals JSON: ' + msg);
      }
  });
}

// Register custom language
monaco.languages.register({ id: 'verse' });

// Set syntax highlighting
monaco.languages.setMonarchTokensProvider('verse', {
  // Set defaultToken to invalid to see what you do not tokenize yet
  defaultToken: 'invalid',
  
  keywords: [
    'if', 'else', 'while', 'function', 'fn', 'return', 'let', 'const',
    'for', 'break', 'continue', 'true', 'false', 'null'
  ],
  
  typeKeywords: [
    'number', 'string', 'bool', 'array', 'interface', 'void'
  ],
  
  operators: [
    '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=',
    '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%',
    '<<', '>>', '>>>', '+=', '-=', '*=', '/=', '&=', '|=', '^=',
    '%='
  ],
  
  // Common regular expressions
  symbols: /[=><!~?:&|+\-*/^%]+/,
  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
  
  // The main tokenizer
  tokenizer: {
    root: [
      // Identifiers and keywords
      [/[a-z_$][\w$]*/, {
        cases: {
          '@typeKeywords': 'type',
          '@keywords': 'keyword',
          '@default': 'identifier'
        }
      }],
      
      [/[A-Z][\w$]*/, 'type.identifier'], // Type names (PascalCase)
      
      // Whitespace
      { include: '@whitespace' },
      
      // Delimiters and operators
      [/[{}()[\]]/, '@brackets'],
      [/[<>](?!@symbols)/, '@brackets'],
      [/@symbols/, {
        cases: {
          '@operators': 'operator',
          '@default': ''
        }
      }],
      
      // Numbers
      [/\d*\.\d+([eE][-+]?\d+)?/, 'number.float'],
      [/0[xX][0-9a-fA-F]+/, 'number.hex'],
      [/\d+/, 'number'],
      
      // Delimiter: after number because of .\d floats
      [/[;,.]/, 'delimiter'],
      
      // Strings
      [/"([^"\\]|\\.)*$/, 'string.invalid'], // non-teminated string
      [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
      
      // Characters
      [/'[^\\']'/, 'string'],
      [/(')(@escapes)(')/, ['string', 'string.escape', 'string']],
      [/'/, 'string.invalid']
    ],
    
    comment: [
      [/[^/*]+/, 'comment'],
      [/\/\*/, 'comment', '@push'],
      ["\\*/", 'comment', '@pop'],
      [/[/*]/, 'comment']
    ],
    
    string: [
      [/[^\\"]+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
    ],
    
    whitespace: [
      [/[ \t\r\n]+/, 'white'],
      [/\/\/.*$/, 'comment'],
    ],
  },
});

// Define language configuration
monaco.languages.setLanguageConfiguration('verse', {
  comments: {
    lineComment: '//',
  },
  brackets: [
    ['{', '}'],
    ['[', ']'],
    ['(', ')']
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
  folding: {
    markers: {
      start: new RegExp('^\\s*//\\s*#?region\\b'),
      end: new RegExp('^\\s*//\\s*#?endregion\\b')
    }
  }
});

// Register autocomplete provider
monaco.languages.registerCompletionItemProvider('verse', {
  provideCompletionItems: (model, position) => {
    const word = model.getWordUntilPosition(position);
    const range = {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: word.startColumn,
      endColumn: word.endColumn
    };
    
    const suggestions = [
      // Keywords
      {
        label: 'fn',
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: 'fn ${1:functionName}(${2:params}) -> ${3:ReturnType} {\n\t$0\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Define a function',
        range: range
      },
      {
        label: 'if',
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: 'if (${1:condition}) {\n\t$0\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'If statement',
        range: range
      },
      {
        label: 'else',
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: 'else {\n\t$0\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Else statement',
        range: range
      },
      {
        label: 'while',
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: 'while (${1:condition}) {\n\t$0\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'While loop',
        range: range
      },
      {
        label: 'const',
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: 'const ${1:name}: ${2:type} = ${3:value}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Constant declaration',
        range: range
      },
      {
        label: 'let',
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: 'let ${1:name}: ${2:type} = ${3:value}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Variable declaration',
        range: range
      },
      {
        label: 'return',
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: 'return ${1:value}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Return statement',
        range: range
      },
      // Types
      {
        label: 'string',
        kind: monaco.languages.CompletionItemKind.TypeParameter,
        insertText: 'string',
        documentation: 'String type',
        range: range
      },
      {
        label: 'number',
        kind: monaco.languages.CompletionItemKind.TypeParameter,
        insertText: 'number',
        documentation: 'Number type',
        range: range
      },
      {
        label: 'bool',
        kind: monaco.languages.CompletionItemKind.TypeParameter,
        insertText: 'bool',
        documentation: 'Boolean type',
        range: range
      },
      {
        label: 'array',
        kind: monaco.languages.CompletionItemKind.TypeParameter,
        insertText: 'array',
        documentation: 'Array type',
        range: range
      },
      {
        label: 'null',
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: 'null',
        documentation: 'Null value',
        range: range
      },
      {
        label: 'interface',
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: 'interface ${1:Name} {\n\t$0\n}',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: 'Interface definition',
        range: range
      },
      // Common patterns
      {
        label: 'true',
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: 'true',
        documentation: 'Boolean true',
        range: range
      },
      {
        label: 'false',
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: 'false',
        documentation: 'Boolean false',
        range: range
      },
    ];
    
    return { suggestions: suggestions };
  }
});

// Register hover provider for documentation
monaco.languages.registerHoverProvider('verse', {
  provideHover: (model, position) => {
    const word = model.getWordAtPosition(position);
    if (!word) return null;
    
    const hoverDocs: Record<string, string> = {
      'fn': 'Define a function with optional parameters and return type',
      'if': 'Conditional statement',
      'else': 'Alternative branch for if statement',
      'while': 'Loop while condition is true',
      'const': 'Declare a constant (immutable) variable',
      'let': 'Declare a mutable variable',
      'return': 'Return a value from a function',
      'string': 'Text data type',
      'number': 'Numeric data type',
      'bool': 'Boolean data type (true/false)',
      'array': 'Collection data type',
      'null': 'Represents absence of value',
      'interface': 'Define a structural type',
    };
    
    const doc = hoverDocs[word.word];
    if (doc) {
      return {
        range: new monaco.Range(
          position.lineNumber,
          word.startColumn,
          position.lineNumber,
          word.endColumn
        ),
        contents: [
          { value: `**${word.word}**` },
          { value: doc }
        ]
      };
    }
    
    return null;
  }
});

// Optional: Define a custom theme for Verse
monaco.editor.defineTheme('verse-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: 'C586C0', fontStyle: 'bold' },
    { token: 'type', foreground: '4EC9B0' },
    { token: 'type.identifier', foreground: '4EC9B0' },
    { token: 'identifier', foreground: '9CDCFE' },
    { token: 'string', foreground: 'CE9178' },
    { token: 'number', foreground: 'B5CEA8' },
    { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
    { token: 'operator', foreground: 'D4D4D4' },
  ],
  colors: {
    'editor.background': '#1E1E1E',
  }
});

// Create editor
const editorEl = getRequiredEl('editor');
const editor = monaco.editor.create(editorEl, {
  value: examples[0].code,
  language: 'verse',
  theme: 'verse-dark',
  automaticLayout: true,
  fontSize: 14,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  lineNumbers: 'on',
  roundedSelection: false,
  padding: { top: 10, bottom: 10 }
});

let currentCompileResult: CompileResult | null = null;

// Compile on change
let compileTimeout: NodeJS.Timeout;
editor.onDidChangeModelContent(() => {
  clearTimeout(compileTimeout);
  compileTimeout = setTimeout(() => {
    compileAndAnalyze();
  }, 500);
});

function compileAndAnalyze() {
  const code = editor.getValue();
  
  try {
    const result = compiler.compile(code);
    currentCompileResult = result;
    
    const typeInfoEl = getRequiredEl('typeInfo');
    const compiledCodeEl = getRequiredEl('compiledCode');
    const statusIndicator = getRequiredEl('statusIndicator');
    
    if (result.success) {
      typeInfoEl.className = 'type-info success';
      typeInfoEl.innerHTML = `
        <div class="type-info-label">Return Type</div>
        <div class="type-info-value">${result.returnType}</div>
      `;
      compiledCodeEl.textContent = result.code ?? '';
      statusIndicator.innerHTML = '<span class="status-indicator status-success"></span>';
    } else {
      typeInfoEl.className = 'type-info error';
      typeInfoEl.innerHTML = `
        <div class="type-info-label">Compilation Error</div>
        <div class="type-info-value">${result.error}</div>
      `;
      compiledCodeEl.textContent = '// Error during compilation';
      statusIndicator.innerHTML = '<span class="status-indicator status-error"></span>';
    }
  } catch (error) {
    console.error('Compilation error:', error);
  }
}


// Run button
getRequiredEl('runBtn').addEventListener('click', async () => {
  if (!currentCompileResult || !currentCompileResult.success) {
    alert('Fix compilation errors before running');
    return;
  }
  const compileResult = currentCompileResult as CompileResult;
  
  try {
    const QuickJS = await load()

    Scope.withScope((scope) => {
      const vm = scope.manage(QuickJS.newContext())

      // Create JS code to initialize globals from sampleContext
      const globalsObj = sampleContext;
      const globalsInit = Object.keys(globalsObj).map(k => `var ${k} = ${JSON.stringify(globalsObj[k])}`).join('\n');

      const result = scope.manage(
        vm.unwrapResult(
          vm.evalCode(`
            ${globalsInit}

            const floor = Math.floor

            async function main() {
              ${compileResult.code}
            }

            main()
          `)
        )
      )

      while (vm.runtime.hasPendingJob()) {
        vm.runtime.executePendingJobs()
      }

      // Dump the result; if it's a pending Promise, drive the QuickJS job queue
      // until the promise settles so we get the resolved value.
      const returnedValue = vm.dump(result);

      // console.log("vm result:", vm.getNumber(nextId), "native state:", state)

      // When the withScope block exits, it calls scope.dispose(), which in turn calls
      // the .dispose() methods of all the disposables managed by the scope.

      const resultEl = getRequiredEl('executionResult');
      const resultValueEl = getRequiredEl('resultValue');
      
      resultEl.style.display = 'block';
      resultValueEl.textContent = JSON.stringify(returnedValue, null, 2);
      
      const consoleEl = getRequiredEl('consoleOutput');
      consoleEl.textContent = `Execution successful!\n\nResult:\n${JSON.stringify(returnedValue, null, 2)}`;
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    alert('Execution error: ' + msg);
    const consoleEl = getRequiredEl('consoleOutput');
    consoleEl.textContent = `Error: ${msg}`;
  }
});

// Format button
getRequiredEl('formatBtn').addEventListener('click', () => {
  const code = editor.getValue();
  const formatted = code.trim();
  editor.setValue(formatted);
});

// Load examples
const examplesContainer = getRequiredEl('examples');
examples.forEach((example) => {
  const btn = document.createElement('button');
  btn.className = 'example-btn';
  btn.innerHTML = `
    <div class="example-title">${example.title}</div>
    <div class="example-desc">${example.desc}</div>
  `;
  btn.addEventListener('click', () => {
    editor.setValue(example.code);
  });
  examplesContainer.appendChild(btn);
});

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = (tab as HTMLElement).dataset.tab;
    if (!tabName) return;

    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const content = document.querySelector(`.tab-content[data-tab="${tabName}"]`) as HTMLElement | null;
    if (content) content.classList.add('active');
  });
});

// Initial compilation
compileAndAnalyze();