# TTRPG Script Language

A custom typed scripting language designed for tabletop RPG (TTRPG) systems with full type inference, Monaco editor integration, and compile-to-JavaScript capabilities.

![TTRPG Script Playground](https://via.placeholder.com/800x400?text=TTRPG+Script+Playground)

## 🎲 Features

- **Type Inference**: Automatically infers return types from your scripts
- **Monaco Editor Integration**: Full IDE-like experience with autocomplete, hover info, and error checking
- **Type-Safe**: Catch errors before runtime with static type checking
- **Compiles to JavaScript**: Execute scripts in any JavaScript environment
- **TTRPG-Focused**: Built specifically for character sheets, game logic, and system automation
- **Nested Context Support**: Access parent scope variables in dynamic lists

## 🚀 Try It Online

Visit the [Live Playground](https://bardsballad.github.io/Verse/) to try it out!

## 📦 Installation

```bash
npm install @bardsballad/verse
# or
yarn add @bardsballad/verse
```

## 🎮 Quick Start

### Basic Usage

```typescript
import { VerseScriptCompiler, BUILTIN_TYPES } from '@bardsballad/verse';

// Define your types
const SpellType = VerseScriptCompiler.createObjectType('Spell', {
  name: BUILTIN_TYPES.string,
  level: BUILTIN_TYPES.number,
  damage: BUILTIN_TYPES.string,
});

const contextTypes = {
  casting: SpellCastingType,
  slot: SpellSlotType,
};

// Create compiler
const compiler = new VerseScriptCompiler(contextTypes);

// Compile a script
const result = compiler.compile(`
  const spells = casting.spells.filter(s => s.level <= slot.level)
  return spells
`);

console.log(result.returnType); // "Spell[]"
console.log(result.code);       // Compiled JavaScript
```

### Monaco Editor Integration

```typescript
import { createVerseScriptEditor } from '@bardsballad/verse/monaco';

// Create editor with language service
const { editor, languageService } = createVerseScriptEditor(
  document.getElementById('editor'),
  contextTypes,
  'return casting.spells'
);

// Listen for changes
editor.onDidChangeModelContent(() => {
  const result = languageService.compile(editor.getValue());
  if (result.success) {
    console.log('Return type:', result.returnType);
  }
});
```

## 📚 Language Syntax

### Variables

```javascript
let x = 5
const name = "Gandalf"
```

### Functions

```javascript
fn calculateDamage(spell, level) {
  const baseDamage = spell.damage
  const bonus = level * 2
  return baseDamage + bonus
}
```

### Control Flow

```javascript
if hp <= 0 {
  return "Dead"
} else {
  return "Alive"
}

for spell in casting.spells {
  if spell.level <= 3 {
    // Do something
  }
}
```

### Expressions

```javascript
// Ternary
const status = hp > 0 ? "alive" : "dead"

// Array methods
const lowLevelSpells = spells.filter(s => s.level <= 2)
const spellNames = spells.map(s => s.name)
const healing = spells.find(s => s.name == "Cure Wounds")

// Property access
const currentHp = characterState.hp
const slots = casting.slots[0].current
```

## 🏗️ Project Structure

```
ttrpg-script-lang/
├── src/
│   ├── compiler/
│   │   ├── lexer.ts          # Tokenization
│   │   ├── parser.ts         # AST generation
│   │   ├── type-checker.ts   # Type inference
│   │   ├── code-generator.ts # JavaScript compilation
│   │   └── index.ts          # Main compiler API
│   ├── monaco/
│   │   └── language-service.ts # Monaco integration
│   └── index.ts
├── playground/
│   ├── index.html            # Web playground
│   └── styles.css
├── examples/
│   ├── basic.ttrpg
│   ├── dnd5e-spells.ttrpg
│   └── nested-context.ttrpg
├── tests/
│   ├── lexer.test.ts
│   ├── parser.test.ts
│   ├── type-checker.test.ts
│   └── compiler.test.ts
├── docs/
│   ├── language-reference.md
│   ├── type-system.md
│   └── api.md
├── package.json
├── tsconfig.json
├── vite.config.ts            # For playground
└── README.md
```

## 🔧 Development

### Setup

```bash
# Clone the repository
git clone https://github.com/BardsBallad/Verse.git
cd Verse

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Start playground
npm run playground
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- lexer

# Watch mode
npm test -- --watch
```

### Building the Playground

```bash
# Development
npm run playground:dev

# Production build
npm run playground:build

# Preview production build
npm run playground:preview
```

## 📖 Documentation

- [Language Reference](docs/language-reference.md) - Complete syntax guide
- [Type System](docs/type-system.md) - Understanding types and inference
- [API Documentation](docs/api.md) - Compiler and Monaco API
- [Examples](examples/) - Sample scripts and use cases

## 🎯 Use Cases

### Character Sheet Automation

```javascript
// Calculate attack bonus
fn getAttackBonus(character) {
  const proficiency = character.proficiencyBonus
  const modifier = character.stats.strength.modifier
  return proficiency + modifier
}
```

### Dynamic List Filtering

```javascript
// Get available spells for current slot level
const availableSpells = casting.spells.filter(s => {
  return s.level == slot.level && slot.current > 0
})
return availableSpells
```

### Spell Slot Management

```javascript
// Cast a spell
if slot.current > 0 {
  slot.current = slot.current - 1
  return { success: true, remaining: slot.current }
} else {
  return { success: false, error: "No spell slots remaining" }
}
```

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Roadmap

- [ ] Generics support
- [X] Type annotations (`let x: number = 5`)
- [ ] Dice roll syntax (`roll 2d6 + 3`)
- [ ] Pattern matching
- [ ] Async/await support
- [ ] Standard library of TTRPG functions
- [ ] Language Server Protocol (LSP)
- [ ] VS Code extension

## 📝 License

MIT License - see [LICENSE](LICENSE) for details

## 🙏 Acknowledgments

- Built with [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- Inspired by [TypeScript](https://www.typescriptlang.org/) type system
- Designed for the TTRPG community

## 📧 Contact

- GitHub: [@KingCosmic](https://github.com/KingCosmic)
- Issues: [GitHub Issues](https://github.com/BardsBallad/Verse/issues)

---

Made with ❤️ for the TTRPG community

## Example Scripts

### Filter Spells by Level
```javascript
const filtered = casting.spells.filter(s => s.level <= 2)
return filtered
// Return type: Spell[]
```

### Nested Context Access
```javascript
const spells = casting.spells.filter(s => s.level == slot.level)
return spells
// Return type: Spell[]
```

### Conditional Returns
```javascript
if slot.current <= 0 {
  return null
}
return casting.spells.filter(s => s.level == slot.level)
// Return type: Spell[] | null
```

### Function with Inference
```javascript
fn getSpellsForLevel(level) {
  return casting.spells.filter(s => s.level <= level)
}
return getSpellsForLevel(3)
// Return type: Spell[]
```