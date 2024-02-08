from bs4 import UnicodeDammit
import time

def file_should_not_contain_phrases(filename, offset=0, *phrases):
    """don't fail _too_ hard if the file can't be read for some reason"""
    with open(filename, "rb") as fp:
        raw = fp.read()[offset:]

    text = None

    try:
        text = raw.decode("utf-8")
    except Exception as err:
        print("Failed to read", filename, "forcing unicode...\n", err)
        try:
            text = UnicodeDammit.detwingle(raw).decode("utf-8")
        except Exception as err:
            print("Failed to read", filename, "giving up...\n", err)
            text = None

    matches = {}

    if text is not None:
        for phrase in phrases:
            if phrase in text:
                matches[phrase] = True

        assert not matches, "Phrases found in {}: {}".format(filename, matches)


def wait_until_file_contains(filename, *phrases, retries: int=20, interval: float=0.5):
    for i in range(retries):
        try:
            file_should_not_contain_phrases(filename, 0, *phrases)
            time.sleep(interval)
        except AssertionError as err:
            print(err)
            return True

    raise RuntimeError(
        f"After {retries*interval}s, {filename} did not contain: {phrases}"
    )
