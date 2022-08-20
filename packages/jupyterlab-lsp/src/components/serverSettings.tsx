import {
  ISettingRegistry,
  ISchemaValidator
} from '@jupyterlab/settingregistry';
import { TranslationBundle } from '@jupyterlab/translation';
import { JSONExt, ReadonlyPartialJSONObject } from '@lumino/coreutils';
import Form, {
  FieldProps,
  IChangeEvent,
  ObjectFieldTemplateProps
} from '@rjsf/core';
import React, { useState } from 'react';

import { LanguageServerManager } from '../manager';
import { TLanguageServerId, TLanguageServerSpec } from '../tokens';

import { ServerLinksList } from './utils';

namespace LanguageServerSettingsEditor {
  export interface IProps extends FieldProps {
    settingRegistry: ISettingRegistry;
    languageServerManager: LanguageServerManager;
    trans: TranslationBundle;
    defaults: ReadonlyPartialJSONObject;
    validationErrors: ISchemaValidator.IError[];
  }
  export interface IState {
    // TODO
  }
}

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
      baseTemplate: (this.props.registry as any).ObjectFieldTemplate,
      objectSelector: props => {
        return (
          props.title === this.props.schema.title &&
          props.description === this.props.schema.description
        );
      },
      trans: this.props.trans,
      languageServerManager: this.props.languageServerManager
    });
    this._defaults = this.props.defaults;
  }

  render(): JSX.Element {
    this.props.schema.description = undefined;
    // hide the boilerplate title/description from schema definitions
    for (const serverSchema of Object.values(this.props.schema.properties!)) {
      (serverSchema as any).title = null;
      (serverSchema as any).description = undefined;
    }

    const validationErrors = this.props.validationErrors.map(error => (
      <li key={'lsp-validation-error-' + error.dataPath}>
        <b>{error.keyword}</b>: {error.message} in <code>{error.dataPath}</code>
        {error.params && 'allowedValues' in error.params
          ? this.props.trans.__(
              'allowed values: %1',
              JSON.stringify(error.params.allowedValues)
            )
          : null}
      </li>
    ));

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
        <Form
          schema={this.props.schema}
          formData={this.state}
          // note: default JupyterLab `FieldTemplate` cannot correctly distinguish fields
          // modified relative to programatically populated (transformed) schema >of objects<;
          // the issue is in lines: https://github.com/jupyterlab/jupyterlab/blob/c2907074e58725942946a73a823fc60e1795da39/packages/settingeditor/src/SettingsFormEditor.tsx#L254-L272
          // this is because 1) the schemaIds does not include the object key
          // 2) the code assumes all objects on the same have the same defaults
          // Probably the solution is to perform modification check on the level of ObjectFieldTemplate instead; this should be implemented upstream in JupyterLab.
          FieldTemplate={(this.props.registry as any).FieldTemplate}
          ArrayFieldTemplate={(this.props.registry as any).ArrayFieldTemplate}
          ObjectFieldTemplate={this._objectTemplate}
          uiSchema={this.props.uiSchema}
          fields={this.props.renderers}
          formContext={this.props.formContext}
          liveValidate
          idPrefix={this.props.idPrefix + '_language_servers'}
          onChange={this._onChange.bind(this)}
        />
      </div>
    );
  }

  private _onChange(e: IChangeEvent<ReadonlyPartialJSONObject>): void {
    this.setState(e.formData);
    this.props.onChange(e.formData);
  }

  protected _filterOutDefaults(settings: any) {
    // TODO: while using this for `this.props.onChange(e.formData);` does correctly
    // remove values we don't want, there is a feed back loop out of our control
    // which uses these same values to populate the form, and everything which was
    // set to "undefined" gets a falsy value instead of the default defating the effort.
    // Also that can lead to catastrophic feedback loop which would have to be mitigated.
    for (let [serverKey, serverSettings] of Object.entries(settings)) {
      const serverDefaults = this._defaults[serverKey];
      if (serverDefaults == null) {
        continue;
      }
      for (let [settingKey, settingValue] of Object.entries(
        serverSettings as any
      )) {
        const settingDefault = serverDefaults[settingKey];
        if (settingKey === 'serverSettings') {
          for (let [subKey, subValue] of Object.entries(settingValue as any)) {
            if (JSONExt.deepEqual(subValue as any, settingDefault[subKey])) {
              console.debug('Deleting default', serverKey, settingKey, subKey);
              settings[serverKey][settingKey][subKey] = undefined;
            }
          }
        } else {
          if (JSONExt.deepEqual(settingValue as any, settingDefault)) {
            console.debug('Deleting default', settingKey);
            settings[serverKey][settingKey] = undefined;
          }
        }
      }
    }
    return settings;
  }

  private _objectTemplate: React.FC<ObjectFieldTemplateProps>;
  private _defaults: Record<string, any>;
}

/**
 * Template for tabbed interface.
 */
const TabbedObjectTemplateFactory = (options: {
  baseTemplate: (props: ObjectFieldTemplateProps) => JSX.Element;
  languageServerManager: LanguageServerManager;
  objectSelector: (props: ObjectFieldTemplateProps) => boolean;
  trans: TranslationBundle;
}): React.FC<ObjectFieldTemplateProps> => {
  const factory = (props: ObjectFieldTemplateProps) => {
    if (!options.objectSelector(props)) {
      return options.baseTemplate(props);
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
      return (
        <div>
          <h4 className={'lsp-ServerSettings-content-name'}>
            {spec.display_name}
          </h4>
          <ServerLinksList specification={spec} />
        </div>
      );
    };
    const manager = options.languageServerManager;
    const trans = options.trans;

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
            {manager.specs.has(tab as TLanguageServerId)
              ? renderServerMetadata(
                  manager.specs.get(tab as TLanguageServerId)!
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
