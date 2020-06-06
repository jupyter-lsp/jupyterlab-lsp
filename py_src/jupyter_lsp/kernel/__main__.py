""" Entry point for kernel

    it may be neccessary to make a ilsp_kernel_launcher.py because of PYTHONPATH
    madness
"""
# pragma: no cover
from .kernel import launch

if __name__ == "__main__":
    launch()
