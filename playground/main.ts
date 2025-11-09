// ============================================================================
// playground/main.ts
// ============================================================================
import * as monaco from 'monaco-editor';
// import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import { BUILTIN_TYPES } from '../src/index';
import VerseScriptCompiler from '../src/compiler';

// Setup Monaco workers
self.MonacoEnvironment = {
  getWorker(workerId: string, label: string) {
    const getWorkerModule = (moduleUrl: string, label: string) => {
      const workerUrl = self.MonacoEnvironment?.getWorkerUrl?.(moduleUrl, label) ?? moduleUrl;
      
      return new Worker(workerUrl, {
        name: label,
        type: 'module'
      });
    };

		switch (label) {
			case 'json':
				return getWorkerModule('/monaco-editor/esm/vs/language/json/json.worker?worker', label);
			case 'css':
			case 'scss':
			case 'less':
				return getWorkerModule('/monaco-editor/esm/vs/language/css/css.worker?worker', label);
			case 'html':
			case 'handlebars':
			case 'razor':
				return getWorkerModule('/monaco-editor/esm/vs/language/html/html.worker?worker', label);
			case 'typescript':
			case 'javascript':
				return getWorkerModule('/monaco-editor/esm/vs/language/typescript/ts.worker?worker', label);
			default:
				return getWorkerModule('/monaco-editor/esm/vs/editor/editor.worker?worker', label);
		}
  },
};

// Sample context data
const sampleContext = {
  characterState: {
    hp: 45,
    maxHp: 60,
    level: 5,
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
    title: "Function with Inference",
    desc: "Define function with automatic return type",
    code: `// Function to get spells for a level
fn getSpellsForLevel(level) {
  const spells = casting.spells.filter(s => s.level <= level)
  return spells
}

return getSpellsForLevel(2)`
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

// Create compiler
const compiler = new VerseScriptCompiler({
  characterState: CharacterStateType,
  casting: SpellCastingType,
  slot: SpellSlotType,
});

// Register custom language
monaco.languages.register({ id: 'verse' });

// Set syntax highlighting
monaco.languages.setMonarchTokensProvider('verse', {
  keywords: [
    'let', 'const', 'if', 'else', 'for', 'in', 'return', 'fn', 'true', 'false', 'null'
  ],
  operators: [
    '=', '>', '<', '!', '==', '<=', '>=', '!=',
    '&&', '||', '+', '-', '*', '/', '%', '=>', '?', ':'
  ],
  symbols: /[=><!~?:&|+\-*\/\^%]+/,
  tokenizer: {
    root: [
      [/[a-zA-Z_]\w*/, {
        cases: {
          '@keywords': 'keyword',
          '@default': 'identifier'
        }
      }],
      [/[0-9]+(\.[0-9]+)?/, 'number'],
      [/"([^"\\]|\\.)*$/, 'string.invalid'],
      [/"/, 'string', '@string'],
      [/'([^'\\]|\\.)*$/, 'string.invalid'],
      [/'/, 'string', '@string_single'],
      [/@symbols/, {
        cases: {
          '@operators': 'operator',
          '@default': ''
        }
      }],
      [/\/\/.*$/, 'comment'],
    ],
    string: [
      [/[^\\"]+/, 'string'],
      [/"/, 'string', '@pop']
    ],
    string_single: [
      [/[^\\']+/, 'string'],
      [/'/, 'string', '@pop']
    ],
  }
});

// Create editor
const editor = monaco.editor.create(document.getElementById('editor')!, {
  value: examples[0].code,
  language: 'verse',
  theme: 'vs-dark',
  automaticLayout: true,
  fontSize: 14,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  lineNumbers: 'on',
  roundedSelection: false,
  padding: { top: 10, bottom: 10 }
});

let currentCompileResult: any = null;

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
    
    const typeInfoEl = document.getElementById('typeInfo')!;
    const compiledCodeEl = document.getElementById('compiledCode')!;
    const statusIndicator = document.getElementById('statusIndicator')!;
    
    if (result.success) {
      typeInfoEl.className = 'type-info success';
      typeInfoEl.innerHTML = `
        <div class="type-info-label">Return Type</div>
        <div class="type-info-value">${result.returnType}</div>
      `;
      compiledCodeEl.textContent = result.code!;
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
  } catch (error: any) {
    console.error('Compilation error:', error);
  }
}

// Run button
document.getElementById('runBtn')!.addEventListener('click', () => {
  if (!currentCompileResult || !currentCompileResult.success) {
    alert('Fix compilation errors before running');
    return;
  }
  
  try {
    const fn = new Function(
      'characterState',
      'casting',
      'slot',
      currentCompileResult.code
    );
    
    const result = fn(
      sampleContext.characterState,
      sampleContext.casting,
      sampleContext.slot
    );
    
    const resultEl = document.getElementById('executionResult')!;
    const resultValueEl = document.getElementById('resultValue')!;
    
    resultEl.style.display = 'block';
    resultValueEl.textContent = JSON.stringify(result, null, 2);
    
    const consoleEl = document.getElementById('consoleOutput')!;
    consoleEl.textContent = `Execution successful!\n\nResult:\n${JSON.stringify(result, null, 2)}`;
    
  } catch (error: any) {
    alert('Execution error: ' + error.message);
    const consoleEl = document.getElementById('consoleOutput')!;
    consoleEl.textContent = `Error: ${error.message}`;
  }
});

// Format button
document.getElementById('formatBtn')!.addEventListener('click', () => {
  const code = editor.getValue();
  const formatted = code.trim();
  editor.setValue(formatted);
});

// Load examples
const examplesContainer = document.getElementById('examples')!;
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
    const tabName = (tab as HTMLElement).dataset.tab!;
    
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`.tab-content[data-tab="${tabName}"]`)!.classList.add('active');
  });
});

// Initial compilation
compileAndAnalyze();