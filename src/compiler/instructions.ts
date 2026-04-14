// ============================================================================
// JSON Instruction Types for Code Generation
// ============================================================================

export type Instruction =
  | DeclareVarInstruction
  | AssignInstruction
  | SetInstruction
  | PrintInstruction
  | IfInstruction
  | ForInstruction
  | CallInstruction
  | ReturnInstruction
  | FunctionDeclarationInstruction
  | MethodCallInstruction
  | ArrayInstruction
  | ObjectInstruction
  | MemberAccessInstruction
  | ArrowFunctionInstruction
  | AwaitInstruction
  | ThrowInstruction;

export interface DeclareVarInstruction {
  type: 'declare_var';
  name: string;
  value: any;
  constant: boolean;
}

export interface AssignInstruction {
  type: 'assign';
  name: string;
  value: any;
}

export interface SetInstruction {
  type: 'set';
  path: string[];
  value: any;
}

export interface PrintInstruction {
  type: 'print';
  value: any;
}

export interface IfInstruction {
  type: 'if';
  condition: any;
  then: Instruction[];
  else?: Instruction[];
}

export interface CallInstruction {
  type: 'call';
  name: string;
  args: any[];
}

export interface ReturnInstruction {
  type: 'return';
  value?: any;
}

export interface FunctionDeclarationInstruction {
  type: 'function_decl';
  name: string;
  params: string[];
  body: Instruction[];
  async: boolean;
}

export interface MethodCallInstruction {
  type: 'method_call';
  object: string;
  method: string;
  args: any[];
}

export interface ArrayInstruction {
  type: 'array';
  elements: any[];
}

export interface ObjectInstruction {
  type: 'object';
  properties: { key: string; value: any }[];
}

export interface MemberAccessInstruction {
  type: 'member_access';
  object: any;
  property: string | any;
  computed: boolean;
}

export interface ArrowFunctionInstruction {
  type: 'arrow_function';
  params: string[];
  body: any;
}

export interface ForInstruction {
  type: 'for';
  variable: string;
  iterable: any;
  body: Instruction[];
  async: boolean;
}

export interface AwaitInstruction {
  type: 'await';
  expression: any;
}

export interface ThrowInstruction {
  type: 'throw';
  value: any;
}