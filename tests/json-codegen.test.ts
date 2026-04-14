import { describe, it, expect } from 'vitest';
import { Lexer } from '../src/compiler/lexer';
import { Parser } from '../src/compiler/parser';
import { JSONCodeGenerator } from '../src/compiler/json-generator';
import { JSONProcessor } from '../src/compiler/json-processor';

describe('JSON Code Generator and Processor', () => {
  it('should generate and process simple variable declaration', () => {
    const source = 'let x = 5';
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    const generator = new JSONCodeGenerator();
    const instructions = generator.generate(ast);

    expect(instructions).toHaveLength(1);
    expect(instructions[0]).toEqual({
      type: 'declare_var',
      name: 'x',
      value: 5,
      constant: false
    });

    const processor = new JSONProcessor();
    const result = processor.process(instructions);

    expect(result.modifiedValues['x']).toBe(5);
  });

  it('should generate and process print statement', () => {
    const source = 'print("hello")';
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    const generator = new JSONCodeGenerator();
    const instructions = generator.generate(ast);

    expect(instructions).toHaveLength(1);
    expect(instructions[0]).toEqual({
      type: 'print',
      value: "hello"
    });

    // Processor would print "hello" to console
    const processor = new JSONProcessor();
    processor.process(instructions);
  });

  it('should generate and process if statement', () => {
    const source = 'if (true) { let y = 10 }';
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    const generator = new JSONCodeGenerator();
    const instructions = generator.generate(ast);

    expect(instructions).toHaveLength(1);
    expect(instructions[0].type).toBe('if');
    expect(instructions[0].condition).toBe(true);
    expect(instructions[0].then).toHaveLength(1);
    expect(instructions[0].then[0]).toEqual({
      type: 'declare_var',
      name: 'y',
      value: 10,
      constant: false
    });

    const processor = new JSONProcessor();
    const result = processor.process(instructions);
    expect(result.modifiedValues['y']).toBe(10);
  });

  it('should accept and use initial context', () => {
    // Context variables should be accessible in the processor
    const context = { x: 42, y: 100 };
    const processor = new JSONProcessor(context);
    
    // Process instructions that reference context variables
    const instructions = [
      { 
        type: 'declare_var' as const, 
        name: 'z', 
        value: { type: 'var', name: 'x' }, // Reference to context variable x
        constant: false 
      }
    ];
    
    const result = processor.process(instructions);

    expect(result.modifiedValues['z']).toBe(42);
  });

  it('should track only modified variables', () => {
    const instructions = [
      { type: 'declare_var' as const, name: 'a', value: 1, constant: false },
      { type: 'declare_var' as const, name: 'b', value: 2, constant: false },
      { type: 'assign' as const, name: 'a', value: 10 }
    ];

    const context = { c: 3 };
    const processor = new JSONProcessor(context);
    const result = processor.process(instructions);

    expect(Object.keys(result.modifiedValues).length).toBe(2);
    expect(result.modifiedValues['a']).toBe(10);
    expect(result.modifiedValues['b']).toBe(2);
    expect('c' in result.modifiedValues).toBe(false); // From context, not modified
  });

  it('should call methods from context', () => {
    let callCount = 0;
    const context = {
      logger: {
        log: (msg: string) => {
          callCount++;
          console.log(`[LOG] ${msg}`);
        }
      }
    };

    const instructions = [
      {
        type: 'method_call' as const,
        object: 'logger',
        method: 'log',
        args: ['test message']
      }
    ];

    const processor = new JSONProcessor(context);
    processor.process(instructions);

    expect(callCount).toBe(1);
  });

  it('should generate and process array expressions', () => {
    const source = 'let arr = [1, 2, 3]';
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    const generator = new JSONCodeGenerator();
    const instructions = generator.generate(ast);

    expect(instructions).toHaveLength(1);
    expect(instructions[0]).toEqual({
      type: 'declare_var',
      name: 'arr',
      value: {
        type: 'array',
        elements: [1, 2, 3]
      },
      constant: false
    });

    const processor = new JSONProcessor();
    const result = processor.process(instructions);

    expect(result.modifiedValues['arr']).toEqual([1, 2, 3]);
  });

  it('should generate and process object expressions', () => {
    const source = 'let obj = { name: "test", value: 42 }';
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    const generator = new JSONCodeGenerator();
    const instructions = generator.generate(ast);

    expect(instructions).toHaveLength(1);
    expect(instructions[0]).toEqual({
      type: 'declare_var',
      name: 'obj',
      value: {
        type: 'object',
        properties: [
          { key: 'name', value: 'test' },
          { key: 'value', value: 42 }
        ]
      },
      constant: false
    });

    const processor = new JSONProcessor();
    const result = processor.process(instructions);

    expect(result.modifiedValues['obj']).toEqual({ name: 'test', value: 42 });
  });

  it('should generate and process member access', () => {
    const source = 'let obj = { name: "test" }\nprint(obj.name)';
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    const generator = new JSONCodeGenerator();
    const instructions = generator.generate(ast);

    expect(instructions).toHaveLength(2);
    expect(instructions[0]).toEqual({
      type: 'declare_var',
      name: 'obj',
      value: {
        type: 'object',
        properties: [{ key: 'name', value: 'test' }]
      },
      constant: false
    });
    expect(instructions[1]).toEqual({
      type: 'print',
      value: {
        type: 'member_access',
        object: { type: 'var', name: 'obj' },
        property: 'name',
        computed: false
      }
    });

    const processor = new JSONProcessor();
    const result = processor.process(instructions);

    expect(result.modifiedValues['obj']).toEqual({ name: 'test' });
  });

  it('should generate and process for loops', () => {
    const source = 'let sum = 0\nfor item in [1, 2, 3] { sum = sum + item }';
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    const generator = new JSONCodeGenerator();
    const instructions = generator.generate(ast);

    expect(instructions).toHaveLength(2);
    expect(instructions[0]).toEqual({
      type: 'declare_var',
      name: 'sum',
      value: 0,
      constant: false
    });
    expect(instructions[1]).toEqual({
      type: 'for',
      variable: 'item',
      iterable: {
        type: 'array',
        elements: [1, 2, 3]
      },
      body: [{
        type: 'assign',
        name: 'sum',
        value: {
          type: 'binary',
          operator: '+',
          left: { type: 'var', name: 'sum' },
          right: { type: 'var', name: 'item' }
        }
      }],
      async: false
    });

    const processor = new JSONProcessor();
    const result = processor.process(instructions);

    expect(result.modifiedValues['sum']).toBe(6);
  });

  it('should handle complex expressions with arrays and objects', () => {
    const instructions = [
      {
        type: 'declare_var' as const,
        name: 'data',
        value: {
          type: 'object',
          properties: [
            { key: 'items', value: { type: 'array', elements: [1, 2, 3] } },
            { key: 'total', value: 0 }
          ]
        },
        constant: false
      },
      {
        type: 'for' as const,
        variable: 'item',
        iterable: {
          type: 'member_access',
          object: { type: 'var', name: 'data' },
          property: 'items',
          computed: false
        },
        body: [{
          type: 'assign',
          name: 'data',
          value: {
            type: 'object',
            properties: [
              { key: 'items', value: { type: 'member_access', object: { type: 'var', name: 'data' }, property: 'items', computed: false } },
              { key: 'total', value: { type: 'binary', operator: '+', left: { type: 'member_access', object: { type: 'var', name: 'data' }, property: 'total', computed: false }, right: { type: 'var', name: 'item' } } }
            ]
          }
        }],
        async: false
      }
    ];

    const processor = new JSONProcessor();
    const result = processor.process(instructions);

    expect(result.modifiedValues['data']).toEqual({ items: [1, 2, 3], total: 6 });
  });

  it('should support function calls with arguments', () => {
    const instructions = [
      {
        type: 'function_decl' as const,
        name: 'add',
        params: ['a', 'b'],
        body: [
          { type: 'return', value: { type: 'binary', operator: '+', left: { type: 'var', name: 'a' }, right: { type: 'var', name: 'b' } } }
        ],
        async: false
      },
      { type: 'declare_var' as const, name: 'result', value: { type: 'call_expr', callee: { type: 'var', name: 'add' }, args: [5, 3] }, constant: false }
    ];

    const processor = new JSONProcessor();
    const result = processor.process(instructions);

    expect(result.modifiedValues['result']).toBe(8);
  });

  it('should support more binary operators', () => {
    const instructions = [
      { type: 'declare_var' as const, name: 'a', value: 5, constant: false },
      { type: 'declare_var' as const, name: 'b', value: 10, constant: false },
      { type: 'declare_var' as const, name: 'c', value: { type: 'binary', operator: '+', left: { type: 'var', name: 'a' }, right: { type: 'var', name: 'b' } }, constant: false },
      { type: 'declare_var' as const, name: 'd', value: { type: 'binary', operator: '*', left: { type: 'var', name: 'a' }, right: { type: 'var', name: 'b' } }, constant: false },
      { type: 'declare_var' as const, name: 'e', value: { type: 'binary', operator: '%', left: { type: 'var', name: 'b' }, right: { type: 'var', name: 'a' } }, constant: false },
      { type: 'declare_var' as const, name: 'f', value: { type: 'binary', operator: '<', left: { type: 'var', name: 'a' }, right: { type: 'var', name: 'b' } }, constant: false },
      { type: 'declare_var' as const, name: 'g', value: { type: 'binary', operator: '&&', left: true, right: false }, constant: false }
    ];

    const processor = new JSONProcessor();
    const result = processor.process(instructions);

    expect(result.modifiedValues['c']).toBe(15); // 5 + 10
    expect(result.modifiedValues['d']).toBe(50); // 5 * 10
    expect(result.modifiedValues['e']).toBe(0);  // 10 % 5
    expect(result.modifiedValues['f']).toBe(true); // 5 < 10
    expect(result.modifiedValues['g']).toBe(false); // true && false
  });

  it('should support await expressions', () => {
    // For now, await just evaluates the expression (full async support would need promises)
    const instructions = [
      { type: 'declare_var' as const, name: 'result', value: { type: 'await', expression: 42 }, constant: false }
    ];

    const processor = new JSONProcessor();
    const result = processor.process(instructions);

    expect(result.modifiedValues['result']).toBe(42);
  });

  it('should support error throwing', () => {
    const instructions = [
      { type: 'throw' as const, value: 'test error' }
    ];

    const processor = new JSONProcessor();

    expect(() => processor.process(instructions)).toThrow('test error');
  });

  it('should handle function calls with default parameter values', () => {
    const instructions = [
      {
        type: 'function_decl' as const,
        name: 'testFunc',
        params: ['x', 'y'],
        body: [
          { type: 'return', value: { type: 'binary', operator: '+', left: { type: 'var', name: 'x' }, right: { type: 'var', name: 'y' } } }
        ],
        async: false
      },
      { type: 'declare_var' as const, name: 'result1', value: { type: 'call_expr', callee: { type: 'var', name: 'testFunc' }, args: [5, 10] }, constant: false },
      { type: 'declare_var' as const, name: 'result2', value: { type: 'call_expr', callee: { type: 'var', name: 'testFunc' }, args: [3] }, constant: false } // y will be undefined
    ];

    const processor = new JSONProcessor();
    const result = processor.process(instructions);

    expect(result.modifiedValues['result1']).toBe(15); // 5 + 10
    expect(result.modifiedValues['result2']).toBe(NaN); // 3 + undefined
  });
});