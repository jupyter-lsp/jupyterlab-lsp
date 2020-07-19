""" install the kernel

    adapted from
    https://github.com/ipython/ipykernel/blob/8fd6297/ipykernel/kernelspec.py

"""

import json
import os
import shutil
import sys
import tempfile

from jupyter_client.kernelspec import KernelSpecManager

pjoin = os.path.join

KERNEL_NAME = "jupyter-lsp-kernel"
DISPLAY_NAME = "Language Server Protocol"

# path to kernelspec resources
RESOURCES = pjoin(os.path.dirname(__file__), "resources")


def make_lsp_cmd(mod="jupyter_lsp.kernel", executable=None, extra_arguments=None, **kw):
    """Build Popen command list for launching an Language Server Protocol kernel.
    Parameters
    ----------
    mod : str, optional (default 'jupyter_lsp.kernel')
        A string of a module whose __main__ starts an Language Server kernel
    executable : str, optional (default sys.executable)
        The Python executable to use for the kernel process.
    extra_arguments : list, optional
        A list of extra arguments to pass when executing the launch code.
    Returns
    -------
    A Popen command list
    """
    if executable is None:
        executable = sys.executable
    extra_arguments = extra_arguments or []
    arguments = [executable, "-m", mod, "-f", "{connection_file}"]
    arguments.extend(extra_arguments)

    return arguments


def get_kernel_dict(extra_arguments=None):
    """Construct dict for kernel.json"""
    return {
        "argv": make_lsp_cmd(extra_arguments=extra_arguments),
        "display_name": DISPLAY_NAME,
        "language": "lsp",
    }


def write_kernel_spec(path=None, overrides=None, extra_arguments=None):
    """Write a kernel spec directory to `path`

    If `path` is not specified, a temporary directory is created.
    If `overrides` is given, the kernelspec JSON is updated before writing.

    The path to the kernelspec is always returned.
    """
    if path is None:
        path = os.path.join(tempfile.mkdtemp(suffix="_kernels"), KERNEL_NAME)

    # stage resources
    shutil.copytree(RESOURCES, path)
    # write kernel.json
    kernel_dict = get_kernel_dict(extra_arguments)

    if overrides:
        kernel_dict.update(overrides)
    with open(pjoin(path, "kernel.json"), "w") as f:
        json.dump(kernel_dict, f, indent=1)

    return path


def install(
    kernel_spec_manager=None,
    user=False,
    kernel_name=KERNEL_NAME,
    display_name=None,
    prefix=None,
):
    """Install the Language Server kernelspec for Jupyter

    Parameters
    ----------

    kernel_spec_manager: KernelSpecManager [optional]
        A KernelSpecManager to use for installation.
        If none provided, a default instance will be created.
    user: bool [default: False]
        Whether to do a user-only install, or system-wide.
    kernel_name: str, optional
        Specify a name for the kernelspec.
        This is needed for having multiple IPython kernels for different
        environments.
    display_name: str, optional
        Specify the display name for the kernelspec
    profile: str, optional
        Specify a custom profile to be loaded by the kernel.
    prefix: str, optional
        Specify an install prefix for the kernelspec.
        This is needed to install into a non-default location, such as a
        conda/virtual-env.
    Returns
    -------

    The path where the kernelspec was installed.
    """
    extra_arguments = None
    if kernel_spec_manager is None:
        kernel_spec_manager = KernelSpecManager()

    if (kernel_name != KERNEL_NAME) and (display_name is None):
        # kernel_name is specified and display_name is not
        # default display_name to kernel_name
        display_name = kernel_name
    overrides = {}
    if display_name:
        overrides["display_name"] = display_name
    else:
        extra_arguments = None
    path = write_kernel_spec(overrides=overrides, extra_arguments=extra_arguments)
    dest = kernel_spec_manager.install_kernel_spec(
        path, kernel_name=kernel_name, user=user, prefix=prefix
    )
    # cleanup afterward
    shutil.rmtree(path)
    return dest
