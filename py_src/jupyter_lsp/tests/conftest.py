from pytest import fixture

from .. import LanguageServerManager  # KeyedLanguageServerSpecs


@fixture
def manager() -> LanguageServerManager:
    return LanguageServerManager()


@fixture(params=[None, []])
def falsy_pyls(request):
    return request.param
