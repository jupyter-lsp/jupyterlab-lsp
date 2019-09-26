import sys

__import__("setuptools").setup(
    setup_requires=["pytest-runner"] if "test" in sys.argv else []
)
