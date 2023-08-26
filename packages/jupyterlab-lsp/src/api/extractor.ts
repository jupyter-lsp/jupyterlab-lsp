/**
 * Extractor Public API
 *
 * Please note that this APIs can be subject to change and relocation to separate package in the future releases.
 *
 * @see https://github.com/jupyter-lsp/jupyterlab-lsp/issues/561
 */
export { LanguageIdentifier } from '@jupyterlab/lsp/lib/lsp';
/**
 * @deprecated - use `@jupyterlab/lsp`
 */
export { IForeignCodeExtractor, IExtractedCode } from '@jupyterlab/lsp';
export { IForeignCodeExtractorsRegistry } from '../extractors/types';
export { RegExpForeignCodeExtractor } from '../extractors/regexp';
