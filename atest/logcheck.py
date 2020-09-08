import os

from bs4 import UnicodeDammit


def file_should_not_contain_phrases(filename, offset=0, *phrases):
    """don't fail _too_ hard if the file can't be read for some reason"""
    with open(filename, "rb") as fp:
        raw = fp.read()[offset:]

    text = None

    try:
        text = raw.decode("utf-8")
    except Exception as err:
        text = UnicodeDammit.detwingle(raw).decode("utf-8")

    matches = {}

    for phrase in phrases:
        if phrase in text:
            matches[phrase] = True

    assert not matches, "Phrases found in {}: {}".format(filename, matches)
