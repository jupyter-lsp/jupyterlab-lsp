import { ICodeOverride, replacer } from './tokens';

abstract class OverridesMap extends Map<RegExp, string | replacer> {
  protected constructor(magicOverrides: ICodeOverride[]) {
    super(magicOverrides.map(m => [new RegExp(m.pattern), m.replacement]));
  }

  abstract overrideFor(code: string): string | null;

  protected _overrideFor(code: string): string | null {
    for (let [key, value] of this) {
      if (code.match(key)) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return code.replace(key, value);
      }
    }
    return null;
  }
}

export class ReversibleOverridesMap extends OverridesMap {
  private overrides: ICodeOverride[];

  constructor(magicOverrides: ICodeOverride[]) {
    super(magicOverrides);
    this.overrides = magicOverrides;
  }

  get reverse(): OverridesMap {
    return this.type(
      this.overrides
        .filter(override => override.reverse != null)
        .map(override => override.reverse!)
    );
  }

  type(overrides: ICodeOverride[]) {
    return new ReversibleOverridesMap(overrides);
  }

  overrideFor(cell: string): string | null {
    return super._overrideFor(cell);
  }

  replaceAll(
    rawLines: string[],
    map: OverridesMap = this
  ): { lines: string[]; skipInspect: boolean[] } {
    let substitutedLines = new Array<string>();
    let skipInspect = new Array<boolean>();

    for (let i = 0; i < rawLines.length; i++) {
      let line = rawLines[i];
      let override = map.overrideFor(line);
      substitutedLines.push(override == null ? line : override);
      skipInspect.push(override != null);
    }
    return {
      lines: substitutedLines,
      skipInspect: skipInspect
    };
  }

  reverseReplaceAll(rawLines: string[]): string[] {
    return this.replaceAll(rawLines, this.reverse).lines;
  }
}
