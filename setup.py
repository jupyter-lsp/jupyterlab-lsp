import sys

__import__("setuptools").setup(
    setup_requires=["pytest-runner"] if "test" in sys.argv else [],
    # py35 apparently doesn't support putting these in setup.cfg
    data_files=[
        (
            "etc/jupyter/jupyter_notebook_config.d",
            ["py_src/jupyter_lsp/etc/jupyter-lsp-serverextension.json"],
        )
    ],
)
