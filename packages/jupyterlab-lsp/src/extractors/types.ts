import { IForeignCodeExtractor } from '@jupyterlab/lsp';

export interface IForeignCodeExtractorsRegistry {
  [host_language: string]: IForeignCodeExtractor[];
}