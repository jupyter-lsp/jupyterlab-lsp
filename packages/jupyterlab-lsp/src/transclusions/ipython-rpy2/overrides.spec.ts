import { ReversibleOverridesMap } from '../../overrides/maps';

import { overrides } from './overrides';

let R_CELL_MAGIC = `%%R
print(1)
`;

describe('rpy2 IPython overrides', () => {
  describe('rpy2 cell magics', () => {
    let cellMagics = new ReversibleOverridesMap(
      overrides.filter(override => override.scope == 'cell')
    );
    it('overrides cell magic', () => {
      let override = cellMagics.overrideFor(R_CELL_MAGIC)!;
      expect(override).toBe(
        'rpy2.ipython.rmagic.RMagics.R("""print(1)\n""", "")'
      );
      let reverse = cellMagics.reverse.overrideFor(override);
      expect(reverse).toBe(R_CELL_MAGIC);

      override = cellMagics.overrideFor('%%R -i x -o y\nsome\ncode')!;
      expect(override).toBe(
        'y = rpy2.ipython.rmagic.RMagics.R("""some\ncode""", "", x)'
      );
      reverse = cellMagics.reverse.overrideFor(override);
      expect(reverse).toBe('%%R -i x -o y\nsome\ncode');
    });
  });

  describe('rpy2 line magics', () => {
    let lineMagics = new ReversibleOverridesMap(
      overrides.filter(override => override.scope == 'line')
    );

    it('works with other Rdevice', () => {
      let line = '%Rdevice svg';
      let override = lineMagics.overrideFor(line)!;
      expect(override).toBe('rpy2.ipython.rmagic.RMagics.Rdevice(" svg", "")');
      let reverse = lineMagics.reverse.overrideFor(override);
      expect(reverse).toBe(line);
    });

    it('does not overwrite non-rpy2 magics', () => {
      let line = '%RestMagic';
      let override = lineMagics.overrideFor(line);
      expect(override).toBe(null);
    });

    it('works with the short form arguments, inputs and outputs', () => {
      let line = '%R -i x';
      let override = lineMagics.overrideFor(line)!;
      expect(override).toBe('rpy2.ipython.rmagic.RMagics.R("", "", x)');
      let reverse = lineMagics.reverse.overrideFor(override);
      expect(reverse).toBe(line);

      line = '%R -o x';
      override = lineMagics.overrideFor(line)!;
      expect(override).toBe('x = rpy2.ipython.rmagic.RMagics.R("", "")');
      reverse = lineMagics.reverse.overrideFor(override);
      expect(reverse).toBe(line);

      line = '%R -i x command()';
      override = lineMagics.overrideFor(line)!;
      expect(override).toBe(
        'rpy2.ipython.rmagic.RMagics.R(" command()", "", x)'
      );
      reverse = lineMagics.reverse.overrideFor(override);
      expect(reverse).toBe(line);

      line = '%R -i x -w 800 -h 400 command()';
      override = lineMagics.overrideFor(line)!;
      expect(override).toBe(
        'rpy2.ipython.rmagic.RMagics.R(" command()", "-w 800 -h 400", x)'
      );
      reverse = lineMagics.reverse.overrideFor(override);
      expect(reverse).toBe(line);

      line = '%R -i x -o y -i z command()';
      override = lineMagics.overrideFor(line)!;
      expect(override).toBe(
        'y = rpy2.ipython.rmagic.RMagics.R(" command()", "", x, z)'
      );

      line = '%R -i x -i z -o y -o w command()';
      override = lineMagics.overrideFor(line)!;
      expect(override).toBe(
        'y, w = rpy2.ipython.rmagic.RMagics.R(" command()", "", x, z)'
      );
      reverse = lineMagics.reverse.overrideFor(override);
      expect(reverse).toBe(line);
    });

    it('does not substitute magic-like constructs', () => {
      let line = 'print("%R -i x")';
      let override = lineMagics.overrideFor(line);
      expect(override).toBe(null);
    });

    it('works with the long form arguments', () => {
      let line = '%R --input x';
      let override = lineMagics.overrideFor(line)!;
      expect(override).toBe('rpy2.ipython.rmagic.RMagics.R("", "", x)');
      let reverse = lineMagics.reverse.overrideFor(override);
      // TODO: make this preserve the long form
      expect(reverse).toBe('%R -i x');

      line = '%R --width 800 --height 400 command()';
      override = lineMagics.overrideFor(line)!;
      expect(override).toBe(
        'rpy2.ipython.rmagic.RMagics.R(" command()", "--width 800 --height 400")'
      );
      reverse = lineMagics.reverse.overrideFor(override);
      expect(reverse).toBe(line);
    });
  });
});
