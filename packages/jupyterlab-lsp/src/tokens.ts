import { Token } from '@lumino/coreutils';

import { LanguageServer1 as LSPLanguageServerSettings } from './_plugin';
import * as SCHEMA from './_schema';

export type TLanguageId = string;

/**
 * Example server keys==ids that are expected. The list is not exhaustive.
 * Custom server keys are allowed. Constraining the values helps avoid errors,
 * but at runtime any value is allowed.
 */
export type TLanguageServerId =
  | 'pylsp'
  | 'bash-language-server'
  | 'dockerfile-language-server-nodejs'
  | 'javascript-typescript-langserver'
  | 'unified-language-server'
  | 'vscode-css-languageserver-bin'
  | 'vscode-html-languageserver-bin'
  | 'vscode-json-languageserver-bin'
  | 'yaml-language-server'
  | 'r-languageserver';
export type TServerKeys = TLanguageServerId;

export type TLanguageServerSpec = SCHEMA.LanguageServerSpec;
export type TSessionMap = Map<TServerKeys, SCHEMA.LanguageServerSession>;
export type TSpecsMap = Map<TServerKeys, SCHEMA.LanguageServerSpec>;

export type TLanguageServerConfigurations = Partial<
  Record<TServerKeys, LSPLanguageServerSettings>
>;

export interface ILogConsoleCore {
  debug(...args: any[]): void;
  log(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
}

export interface ILSPLogConsole extends ILogConsoleCore {
  scope(scope: string): ILSPLogConsole;
}

export const PLUGIN_ID = '@jupyter-lsp/jupyterlab-lsp';

export const ILSPLogConsole = new Token<ILSPLogConsole>(
  PLUGIN_ID + ':ILSPLogConsole'
);
