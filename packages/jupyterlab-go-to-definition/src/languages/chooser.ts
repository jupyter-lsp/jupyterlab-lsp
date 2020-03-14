import { IEditorExtension } from '../editors/editor';

import { LanguageAnalyzer } from './analyzer';

import { PythonAnalyzer } from './python';
import { RAnalyzer } from './r';

export interface ILanguageAnalyzerConstructor {
  new (editor: IEditorExtension): LanguageAnalyzer;
}

export function chooseLanguageAnalyzer(
  language: string
): ILanguageAnalyzerConstructor {
  switch (language) {
    case 'python': {
      return PythonAnalyzer;
    }
    case 'R': {
      return RAnalyzer;
    }
    default: {
      console.warn(
        language + ' is not supported yet by go-to-definition extension.'
      );
      // once there is C language support, it might be used as a default instead
      return PythonAnalyzer;
    }
  }
}
