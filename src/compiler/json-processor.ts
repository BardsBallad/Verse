// ============================================================================
// JSON Instruction Processor - Interprets JSON Instructions
// ============================================================================

import { Instruction } from "./instructions";

export interface ProcessorContext {
  [key: string]: any;
}

export class JSONProcessor {
  private variables: Map<string, any> = new Map();
  private functions: Map<string, { params: string[], body: Instruction[], async: boolean }> = new Map();
  private modifiedVariables: Set<string> = new Set();
  private readonly RETURN_SENTINEL = Symbol('return');
  private context: ProcessorContext;

  constructor(context: ProcessorContext = {}) {
    this.context = { ...context };
    // Initialize variables from context
    Object.entries(context).forEach(([key, value]) => {
      if (typeof value !== 'function') {
        this.variables.set(key, value);
      }
    });
  }

  process(instructions: Instruction[]): { value: any; modified: string[]; modifiedValues: Record<string, any> } {
    this.modifiedVariables.clear();
    let returnValue: any = undefined;

    for (const instr of instructions) {
      const result = this.executeInstruction(instr);
      if (instr.type === 'return') {
        returnValue = result === this.RETURN_SENTINEL ? undefined : result;
        break;
      }
      if (result !== undefined) {
        returnValue = result === this.RETURN_SENTINEL ? undefined : result;
        break;
      }
    }
    
    const modifiedValues = new Map<string, any>();
    this.modifiedVariables.forEach(path => {
      if (this.variables.has(path)) {
        modifiedValues.set(path, this.variables.get(path));
      } else {
        // For nested paths like "char.hp"
        const pathParts = path.split('.');
        const value = this.getNestedProperty(this.context, pathParts);
        modifiedValues.set(path, value);
      }
    });

    return {
      value: returnValue,
      modified: Array.from(this.modifiedVariables),
      modifiedValues: Object.fromEntries(modifiedValues),
    };
  }

  private executeInstruction(instr: Instruction): any {
    switch (instr.type) {
      case 'declare_var':
        this.variables.set(instr.name, this.evaluate(instr.value));
        this.modifiedVariables.add(instr.name);
        break;
      case 'assign':
        this.variables.set(instr.name, this.evaluate(instr.value));
        this.modifiedVariables.add(instr.name);
        break;
      case 'set':
        this.setNestedProperty(this.context, instr.path, this.evaluate(instr.value));
        this.modifiedVariables.add(instr.path.join('.'));
        break;
      case 'print':
        console.log(this.evaluate(instr.value));
        break;
      case 'if':
        if (this.evaluate(instr.condition)) {
          for (const i of instr.then) {
            const result = this.executeInstruction(i);
            if (result !== undefined) {
              return result;
            }
          }
        } else if (instr.else) {
          for (const i of instr.else) {
            const result = this.executeInstruction(i);
            if (result !== undefined) {
              return result;
            }
          }
        }
        break;
      case 'for':
        const iterable = this.evaluate(instr.iterable);
        if (Array.isArray(iterable)) {
          for (const item of iterable) {
            this.variables.set(instr.variable, item);
            this.modifiedVariables.add(instr.variable);
            for (const i of instr.body) {
              const result = this.executeInstruction(i);
              if (result !== undefined) {
                return result;
              }
            }
          }
        }
        break;
      case 'call':
        const func = this.functions.get(instr.name);
        if (func) {
          // Create a new scope for function parameters
          const oldVariables = new Map(this.variables);
          try {
            // Set parameter values
            func.params.forEach((param, index) => {
              const argValue = index < instr.args.length ? this.evaluate(instr.args[index]) : undefined;
              this.variables.set(param, argValue);
              this.modifiedVariables.add(param);
            });
            
            // Execute function body
            for (const i of func.body) {
              const result = this.executeInstruction(i);
              if (result !== undefined) {
                return result === this.RETURN_SENTINEL ? undefined : result;
              }
            }
          } finally {
            // Restore original variables (except modified ones)
            for (const [key, value] of oldVariables) {
              if (!this.modifiedVariables.has(key)) {
                this.variables.set(key, value);
              }
            }
          }
        }
        break;
      case 'return':
        return instr.value !== undefined ? this.evaluate(instr.value) : this.RETURN_SENTINEL;
      case 'function_decl':
        this.functions.set(instr.name, {
          params: instr.params,
          body: instr.body,
          async: instr.async
        });
        break;
      case 'method_call':
        const obj = this.variables.get(instr.object);
        if (obj && typeof obj === 'object') {
          const method = obj[instr.method];
          if (typeof method === 'function') {
            const args = instr.args.map(arg => this.evaluate(arg));
            return method.apply(obj, args);
          }
        }
        // Also check context
        const contextObj = this.context[instr.object];
        if (contextObj && typeof contextObj === 'object') {
          const method = contextObj[instr.method];
          if (typeof method === 'function') {
            const args = instr.args.map(arg => this.evaluate(arg));
            return method.apply(contextObj, args);
          }
        }
        break;
      case 'await':
        // For now, just evaluate the expression (async support would need more work)
        return this.evaluate(instr.expression);
      case 'throw':
        throw this.evaluate(instr.value);
    }
  }

  private evaluate(expr: any): any {
    if (typeof expr === 'object' && expr !== null) {
      switch (expr.type) {
        case 'var':
          return this.variables.get(expr.name);
        case 'binary':
          const left = this.evaluate(expr.left);
          const right = this.evaluate(expr.right);
          switch (expr.operator) {
            case '+': return left + right;
            case '-': return left - right;
            case '*': return left * right;
            case '/': return left / right;
            case '%': return left % right;
            case '==': return left == right;
            case '!=': return left != right;
            case '<': return left < right;
            case '<=': return left <= right;
            case '>': return left > right;
            case '>=': return left >= right;
            case '&&': return left && right;
            case '||': return left || right;
            // Add more operators
            default: return 0;
          }
        case 'call_expr':
          if (expr.callee.type === 'var') {
            const callFunc = this.functions.get(expr.callee.name);
            if (callFunc) {
              // Create a new scope for function parameters
              const oldVariables = new Map(this.variables);
              try {
                // Set parameter values
                const args = expr.args.map((arg: any) => this.evaluate(arg));
                callFunc.params.forEach((param, index) => {
                  const argValue = index < args.length ? args[index] : undefined;
                  this.variables.set(param, argValue);
                  this.modifiedVariables.add(param);
                });
                
                // Execute function body
                for (const i of callFunc.body) {
                  const result = this.executeInstruction(i);
                  if (result !== undefined) {
                    return result === this.RETURN_SENTINEL ? undefined : result; // Return statement encountered
                  }
                }
                return undefined;
              } finally {
                // Restore original variables (except modified ones)
                for (const [key, value] of oldVariables) {
                  if (!this.modifiedVariables.has(key)) {
                    this.variables.set(key, value);
                  }
                }
              }
            }
            return null;
          } else if (expr.callee.type === 'member_access') {
            const obj = this.evaluate(expr.callee.object);
            const method = expr.callee.computed ? this.evaluate(expr.callee.property) : expr.callee.property;
            const args = expr.args.map((arg: any) => this.evaluate(arg));
            // eslint-disable-next-line prefer-spread
            return obj[method].apply(obj, args);
          }
          return null;
        case 'array':
          return expr.elements.map((elem: any) => this.evaluate(elem));
        case 'object':
          const obj: any = {};
          expr.properties.forEach((prop: { key: string; value: any }) => {
            obj[prop.key] = this.evaluate(prop.value);
          });
          return obj;
        case 'member_access':
          const targetObj = this.evaluate(expr.object);
          const prop = expr.computed ? this.evaluate(expr.property) : expr.property;
          return targetObj[prop];
        case 'await':
          // For now, just evaluate the expression (full async support would need promises)
          return this.evaluate(expr.expression);
        case 'arrow_function':
          return (...args: any[]) => {
            // Create a new scope for function parameters
            const oldVariables = new Map(this.variables);
            try {
              // Set parameter values
              expr.params.forEach((param: string, index: number) => {
                this.variables.set(param, args[index]);
                this.modifiedVariables.add(param);
              });
              
              // Evaluate the body expression
              return this.evaluate(expr.body);
            } finally {
              // Restore original variables (except modified ones)
              for (const [key, value] of oldVariables) {
                if (!this.modifiedVariables.has(key)) {
                  this.variables.set(key, value);
                }
              }
            }
          };
        default:
          return expr;
      }
    }
    return expr;
  }

  private setNestedProperty(obj: any, path: string[], value: any): void {
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (current[key] === undefined || current[key] === null) {
        current[key] = {};
      }
      current = current[key];
    }
    current[path[path.length - 1]] = value;
  }

  private getNestedProperty(obj: any, path: string[]): any {
    let current = obj;
    for (const key of path) {
      if (current === undefined || current === null) {
        return undefined;
      }
      current = current[key];
    }
    return current;
  }
}