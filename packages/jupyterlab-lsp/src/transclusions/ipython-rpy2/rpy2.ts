export const RPY2_MAX_ARGS = 10;

export function extractArgs(args: string[], contentPosition: number) {
  let inputs = [];
  let outputs = [];
  let others = [];
  for (let i = 0; i < args.length; i = i + 2) {
    let arg = args[i];
    let variable = args[i + 1];
    if (arg == null) {
      break;
    } else if (arg === 'i' || arg === '-input') {
      inputs.push(variable);
    } else if (arg === 'o' || arg === '-output') {
      outputs.push(variable);
    } else {
      others.push('-' + arg + ' ' + variable);
    }
  }
  return {
    inputs: inputs,
    outputs: outputs,
    rest: args[args.length + contentPosition],
    others: others
  };
}

export function parseArgs(args: string[], contentPosition: number) {
  let { inputs, outputs, rest, others } = extractArgs(args, contentPosition);
  let inputVariables = inputs.join(', ');
  if (inputVariables) {
    inputVariables = ', ' + inputVariables;
  }
  let outputVariables = outputs.join(', ');
  if (outputVariables) {
    outputVariables = outputVariables + ' = ';
  }
  return {
    content: rest,
    others: others.join(' '),
    inputs: inputVariables,
    outputs: outputVariables
  };
}

export function reversePattern(
  quote = '"',
  multiLine = false,
  magic = 'R'
): string {
  return (
    '(\\S+)?' +
    '(?:, (\\S+))?'.repeat(9) +
    '( = )?rpy2\\.ipython\\.rmagic\\.RMagics.' +
    magic +
    '\\(' +
    quote +
    (multiLine ? '([\\s\\S]*)' : '(.*?)') +
    quote +
    ', "(.*?)"' +
    '(?:, (\\S+))?'.repeat(10) +
    '\\)'
  );
}

export function reverseReplacement(match: string, ...args: string[]) {
  let outputs = [];
  for (let i = 0; i < 10; i++) {
    if (args[i] == null) {
      break;
    }
    outputs.push(args[i]);
  }
  let inputs = [];
  for (let i = 13; i < 23; i++) {
    if (args[i] == null) {
      break;
    }
    inputs.push(args[i]);
  }
  let inputVariables = inputs.join(' -i ');
  if (inputVariables) {
    inputVariables = ' -i ' + inputVariables;
  }
  let outputVariables = outputs.join(' -o ');
  if (outputVariables) {
    outputVariables = ' -o ' + outputVariables;
  }
  let contents = args[11];
  let otherArgs = args[12];
  if (otherArgs) {
    otherArgs = ' ' + otherArgs;
  }
  return {
    input: inputVariables,
    output: outputVariables,
    other: otherArgs,
    contents: contents
  };
}

export function argsPattern(maxN: number) {
  return '(?: -(\\S+) (\\S+))?'.repeat(maxN);
}
