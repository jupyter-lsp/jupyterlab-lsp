from IPython.display import Markdown
from IPython.core.magic import register_cell_magic, needs_local_scope


@register_cell_magic
@needs_local_scope
def markdown(line, cell, local_ns):
    """Cell interpreted as Markdown but with variable substitution support.

    Variables from global environment will be substituted using the standard
    Python format mechanism which uses single curly braces (e.g. {variable})
    """
    return Markdown(cell.format(**local_ns))
