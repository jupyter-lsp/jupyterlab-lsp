""" Entry point for kernel

    it may be neccessary to make a ilsp_kernel_launcher.py because of PYTHONPATH
    madness
"""
from .kernel import launch  # pragma: no cover

if __name__ == "__main__":  # pragma: no cover
    launch()
