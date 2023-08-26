import { ReversibleOverridesMap } from '../../overrides/maps';

import { overrides } from './overrides';

let R_CELL_MAGIC = `%%R
print(1)
`;

describe('rpy2 IPython overrides', () => {
  describe('rpy2 cell magics', () => {
    let cell_magics = new ReversibleOverridesMap(
      overrides.filter(override => override.scope == 'cell')
    );
    it('overrides cell magic', () => {
      let override = cell_magics.override_for(R_CELL_MAGIC)!;
      expect(override).toBe(
        'rpy2.ipython.rmagic.RMagics.R("""print(1)\n""", "")'
      );
      let reverse = cell_magics.reverse.override_for(override);
      expect(reverse).toBe(R_CELL_MAGIC);

      override = cell_magics.override_for('%%R -i x -o y\nsome\ncode')!;
      expect(override).toBe(
        'y = rpy2.ipython.rmagic.RMagics.R("""some\ncode""", "", x)'
      );
      reverse = cell_magics.reverse.override_for(override);
      expect(reverse).toBe('%%R -i x -o y\nsome\ncode');
    });
  });

  describe('rpy2 line magics', () => {
    let line_magics = new ReversibleOverridesMap(
      overrides.filter(override => override.scope == 'line')
    );

    it('works with other Rdevice', () => {
      let line = '%Rdevice svg';
      let override = line_magics.override_for(line)!;
      expect(override).toBe('rpy2.ipython.rmagic.RMagics.Rdevice(" svg", "")');
      let reverse = line_magics.reverse.override_for(override);
      expect(reverse).toBe(line);
    });

    it('does not overwrite non-rpy2 magics', () => {
      let line = '%RestMagic';
      let override = line_magics.override_for(line);
      expect(override).toBe(null);
    });

    it('works with the short form arguments, inputs and outputs', () => {
      let line = '%R -i x';
      let override = line_magics.override_for(line)!;
      expect(override).toBe('rpy2.ipython.rmagic.RMagics.R("", "", x)');
      let reverse = line_magics.reverse.override_for(override);
      expect(reverse).toBe(line);

      line = '%R -o x';
      override = line_magics.override_for(line)!;
      expect(override).toBe('x = rpy2.ipython.rmagic.RMagics.R("", "")');
      reverse = line_magics.reverse.override_for(override);
      expect(reverse).toBe(line);

      line = '%R -i x command()';
      override = line_magics.override_for(line)!;
      expect(override).toBe(
        'rpy2.ipython.rmagic.RMagics.R(" command()", "", x)'
      );
      reverse = line_magics.reverse.override_for(override);
      expect(reverse).toBe(line);

      line = '%R -i x -w 800 -h 400 command()';
      override = line_magics.override_for(line)!;
      expect(override).toBe(
        'rpy2.ipython.rmagic.RMagics.R(" command()", "-w 800 -h 400", x)'
      );
      reverse = line_magics.reverse.override_for(override);
      expect(reverse).toBe(line);

      line = '%R -i x -o y -i z command()';
      override = line_magics.override_for(line)!;
      expect(override).toBe(
        'y = rpy2.ipython.rmagic.RMagics.R(" command()", "", x, z)'
      );

      line = '%R -i x -i z -o y -o w command()';
      override = line_magics.override_for(line)!;
      expect(override).toBe(
        'y, w = rpy2.ipython.rmagic.RMagics.R(" command()", "", x, z)'
      );
      reverse = line_magics.reverse.override_for(override);
      expect(reverse).toBe(line);
    });

    it('does not substitute magic-like constructs', () => {
      let line = 'print("%R -i x")';
      let override = line_magics.override_for(line);
      expect(override).toBe(null);
    });

    it('works with the long form arguments', () => {
      let line = '%R --input x';
      let override = line_magics.override_for(line)!;
      expect(override).toBe('rpy2.ipython.rmagic.RMagics.R("", "", x)');
      let reverse = line_magics.reverse.override_for(override);
      // TODO: make this preserve the long form
      expect(reverse).toBe('%R -i x');

      line = '%R --width 800 --height 400 command()';
      override = line_magics.override_for(line)!;
      expect(override).toBe(
        'rpy2.ipython.rmagic.RMagics.R(" command()", "--width 800 --height 400")'
      );
      reverse = line_magics.reverse.override_for(override);
      expect(reverse).toBe(line);
    });
  });
});
