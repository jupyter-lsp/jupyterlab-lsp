import { ILanguageServerManager, LanguageServerManager } from '@jupyterlab/lsp';
import {
  ISettingRegistry,
  ISchemaValidator
} from '@jupyterlab/settingregistry';
import { TranslationBundle } from '@jupyterlab/translation';
import { FormComponent } from '@jupyterlab/ui-components';
import { ReadonlyPartialJSONObject } from '@lumino/coreutils';
import { IChangeEvent } from '@rjsf/core';
import {
  FieldProps,
  ObjectFieldTemplateProps,
  TemplatesType
} from '@rjsf/utils';
import validatorAjv8 from '@rjsf/validator-ajv8';
import React, { useState } from 'react';

import { TLanguageServerId, TLanguageServerSpec } from '../tokens';

import { ServerLinksList } from './utils';

namespace LanguageServerSettingsEditor {
  export interface IProps extends FieldProps {
    settingRegistry: ISettingRegistry;
    languageServerManager: ILanguageServerManager;
    trans: TranslationBundle;
    validationErrors: ISchemaValidator.IError[];
  }
  // TODO
  export type IState = any;
}
export const renderCollapseConflicts = (props: {
  conflicts: Record<string, Record<string, any[]>>;
  trans: TranslationBundle;
}) => {
  const conflicts = Object.entries(props.conflicts).map(
    ([server, serverConflicts]) => {
      if (Object.keys(serverConflicts).length === 0) {
        return null;
      }
      const listing = Object.entries(serverConflicts).map(([key, values]) => (
        <li key={'lsp-server-setting-conflict-' + key}>
          <code>{key}</code>: <code>{JSON.stringify(values)}</code>
        </li>
      ));
      return (
        <div key={'lsp-server-setting-conflict-' + server}>
          <h4>{server}</h4>
          <ul>{listing}</ul>
        </div>
      );
    }
  );
  return (
    <div>
      {props.trans.__('Multiple distinct values detected for:')}
      {conflicts}
      {props.trans.__(
        'Retaining the last value for each of the settings. Please remove the additional values in JSON Settings Editor.'
      )}
    </div>
  );
};

export const renderLanguageServerSettings = (
  props: LanguageServerSettingsEditor.IProps
) => {
  return <LanguageServerSettings {...props} />;
};

export class LanguageServerSettings extends React.Component<
  LanguageServerSettingsEditor.IProps,
  LanguageServerSettingsEditor.IState
> {
  constructor(props: LanguageServerSettingsEditor.IProps) {
    super(props);
    this.state = { ...props.formData };
    this._objectTemplate = TabbedObjectTemplateFactory({
      baseTemplate: this.props.registry.templates.ObjectFieldTemplate,
      objectSelector: props => {
        return (
          props.title === this.props.schema.title &&
          props.description === this.props.schema.description
        );
      },
      trans: this.props.trans,
      languageServerManager: this.props.languageServerManager
    });
  }

  render(): JSX.Element {
    this.props.schema.description = undefined;
    // hide the boilerplate title/description from schema definitions
    for (const serverSchema of Object.values(this.props.schema.properties!)) {
      // note: have to be strings.
      (serverSchema as any).title = '';
      (serverSchema as any).description = '';
    }

    const validationErrors = this.props.validationErrors.map(error => (
      <li key={'lsp-validation-error-' + error.instancePath}>
        <b>{error.keyword}</b>: {error.message} in{' '}
        <code>{error.instancePath}</code>
        {error.params && 'allowedValues' in error.params
          ? this.props.trans.__(
              'allowed values: %1',
              JSON.stringify(error.params.allowedValues)
            )
          : null}
      </li>
    ));
    const templates = {
      ...this.props.registry.templates,
      ObjectFieldTemplate: this._objectTemplate
    };
    // remove self field to avoid infinite recursion
    const fields = Object.fromEntries(
      Object.entries(this.props.registry.fields).filter(
        f => f[0] != 'language_servers'
      )
    );

    return (
      <div className="lsp-ServerSettings">
        <h3 className="lsp-ServerSettings-title">
          {this.props.trans.__('Language servers')}
        </h3>
        {validationErrors.length > 0 ? (
          <div className="lsp-ServerSettings-validationError">
            <h4>
              {this.props.trans.__(
                'Validation of user settings for language server failed'
              )}
            </h4>
            <p>
              {this.props.trans.__(
                'Your language server settings do not follow current schema. The LSP configuration graphical interface will run in schema-free mode to enable you to continue using the current settings as-is (in case if the schema is outdated). If this is however an earlier configuration mistake (settings were not validated in earlier versions of jupyterlab-lsp), please correct the following validation errors in JSON Settings Editor, save, and reload application:'
              )}
            </p>
            <ul>{validationErrors}</ul>
          </div>
        ) : null}
        <FormComponent
          schema={this.props.schema}
          formData={this.state}
          validator={validatorAjv8}
          // note: default JupyterLab `FieldTemplate` cannot correctly distinguish fields
          // modified relative to programatically populated (transformed) schema >of objects<;
          // the issue is in lines: https://github.com/jupyterlab/jupyterlab/blob/c2907074e58725942946a73a823fc60e1795da39/packages/settingeditor/src/SettingsFormEditor.tsx#L254-L272
          // this is because 1) the schemaIds does not include the object key
          // 2) the code assumes all objects on the same have the same defaults
          // Probably the solution is to perform modification check on the level of ObjectFieldTemplate instead; this should be implemented upstream in JupyterLab.
          // TODO
          templates={templates}
          uiSchema={this.props.uiSchema}
          fields={fields}
          formContext={this.props.formContext}
          liveValidate
          idPrefix={this.props.idPrefix + '_language_servers'}
          onChange={this._onChange.bind(this)}
        />
      </div>
    );
  }

  private _onChange(event: IChangeEvent<ReadonlyPartialJSONObject>): void {
    if (event.errors.length) {
      console.error('Errors in form validation:', event.errors);
    }
    this.setState(event.formData, () => this.props.onChange(this.state));
  }

  private _objectTemplate: React.FC<ObjectFieldTemplateProps>;
}

/**
 * Template for tabbed interface.
 */
const TabbedObjectTemplateFactory = (options: {
  baseTemplate: TemplatesType['ObjectFieldTemplate'];
  languageServerManager: ILanguageServerManager;
  objectSelector: (props: ObjectFieldTemplateProps) => boolean;
  trans: TranslationBundle;
}): React.FC<ObjectFieldTemplateProps> => {
  const factory = (props: ObjectFieldTemplateProps) => {
    if (!options.objectSelector(props)) {
      const BaseTemplate = options.baseTemplate;
      return <BaseTemplate {...props} />;
    }
    const [tab, setTab] = useState(
      props.properties.length > 0 ? props.properties[0].name : null
    );

    const renderServerLabels = (options: {
      properties: typeof props.properties;
      filter: (name: TLanguageServerId) => boolean;
      title: string;
    }) => {
      const retained = options.properties.filter(property =>
        options.filter(property.name as TLanguageServerId)
      );
      if (retained.length == 0) {
        return null;
      }
      return (
        <>
          <h4 className={'lsp-ServerSettings-list-group'}>{options.title}</h4>
          <ul>
            {retained.map(property => {
              return (
                <li
                  onClick={() => setTab(property.name)}
                  key={'tab-' + property.name}
                  data-tab={property.name}
                  className={property.name === tab ? 'lsp-selected' : undefined}
                >
                  {property.name}
                </li>
              );
            })}
          </ul>
        </>
      );
    };
    const renderServerMetadata = (spec: TLanguageServerSpec) => {
      const workspaceConfig = spec.workspace_configuration as Record<
        string,
        any
      >;
      return (
        <div>
          <h4 className={'lsp-ServerSettings-content-name'}>
            {spec.display_name}
          </h4>
          <ServerLinksList specification={spec} />
          {workspaceConfig ? (
            <p className={'lsp-ServerSettings-content-specOverrides'}>
              {trans.__('Default values set programatically for: ') +
                Object.keys(workspaceConfig).join(', ')}
            </p>
          ) : null}
        </div>
      );
    };
    const manager = options.languageServerManager;
    const trans = options.trans;

    // TODO: expose `specs` upstream
    return (
      <fieldset id={props.idSchema.$id}>
        <div className={'lsp-ServerSettings-tabs'}>
          <div className={'lsp-ServerSettings-list'}>
            {renderServerLabels({
              properties: props.properties,
              filter: name => manager.sessions.has(name),
              title: trans.__('Available')
            })}
            {renderServerLabels({
              properties: props.properties,
              filter: name => !manager.sessions.has(name),
              title: trans.__('Not installed')
            })}
          </div>
          <div className={'lsp-ServerSettings-content'}>
            {(manager as LanguageServerManager).specs.has(
              tab as TLanguageServerId
            )
              ? renderServerMetadata(
                  (manager as LanguageServerManager).specs.get(
                    tab as TLanguageServerId
                  )!
                )
              : null}
            {props.properties
              .filter(property => property.name === tab)
              .map(property => property.content)}
          </div>
        </div>
      </fieldset>
    );
  };
  factory.displayName = 'TabbedObjectTemplate';
  return factory;
};
