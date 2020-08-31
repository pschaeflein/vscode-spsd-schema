import * as vscode from 'vscode';
import * as AppInsights from 'applicationinsights';
import * as $RefParser from 'json-schema-ref-parser';
import { Utilities, LocalSchemaStatus } from './utilities';
import { ISiteDesignSchemaConfiguration } from './ISiteDesignSchemaConfiguration';

export class SiteActionSchema {
  static LocalSchemaFilename: string = "sitescript.schema.json";

  private context: vscode.ExtensionContext;
  private configuration: ISiteDesignSchemaConfiguration;
  private outputChannel: vscode.OutputChannel;  
  private storeData: (schema: any, schemaFilePath: string) => Promise<void>;

  public constructor(
    context: vscode.ExtensionContext, 
    configuration: ISiteDesignSchemaConfiguration, 
    outputChannel: vscode.OutputChannel, 
    storeData: (schema: any, schemaFilePath: string) => Promise<void>) {
        this.context = context;
        this.configuration = configuration;
        this.outputChannel = outputChannel;
        this.storeData = storeData;
  }

  public async checkSchemaFile()
  {
    let siteActionFileStatus = await Utilities.getLocalFileStatus(vscode.Uri.joinPath(this.context.extensionUri, SiteActionSchema.LocalSchemaFilename));
    let performRefresh = (siteActionFileStatus != LocalSchemaStatus.current);

    let localStatusMessage = `Local Site Action schema status: ${LocalSchemaStatus[siteActionFileStatus]}`;
    this.outputChannel.appendLine(localStatusMessage);

    if (performRefresh) {
      await this.getAndRefreshSchema();  //extConfiguration.schemaUrl, this.outputChannel, storeData
    }

    if (this.configuration.allowTelemetry && this.context.extensionMode === vscode.ExtensionMode.Production) {
      let eventProps = {
        schema: SiteActionSchema.LocalSchemaFilename,
        refresh: performRefresh,
        status: LocalSchemaStatus[siteActionFileStatus]
      };
      AppInsights.defaultClient.trackEvent({ name: 'refresh-schema', properties: eventProps });
    }
  }

  public async getAndRefreshSchema() {
    const patternEnumStart = "^(";
    const patternEnumEnd = ")$";

    try {
      const schema = await $RefParser.parse(this.configuration.schemaUrl);
      this.outputChannel.appendLine("schema downloaded");

      const actionsProp = schema.properties["actions"] as $RefParser.JSONSchema;
      const actionItems = actionsProp["items"] as $RefParser.JSONSchema;

      let actionItemsSnippets = [];

      const schemaActions = schema.properties.actions as $RefParser.JSONSchema;
      const schemaActionItems = schemaActions.items as $RefParser.JSONSchema;
      for (const key in schemaActionItems.anyOf) {
        if (schemaActionItems.anyOf.hasOwnProperty(key)) {
          const element = schemaActionItems.anyOf[key] as $RefParser.JSONSchema;
          const actionName = element.$ref.replace('#/definitions/', '');

          const actionDef = schema.definitions[actionName] as $RefParser.JSONSchema;

          let actionDefItem;

          // Some actions use 'allOf' to reference the base action. 
          // If so, including 'additionalProperties' causes validation errors (https://json-schema.org/understanding-json-schema/reference/combining.html)
          //   also, grab the array element that has properties, not the reference
          if (actionDef.hasOwnProperty('allOf')) {
            let actionDefAllOf = actionDef.allOf as $RefParser.JSONSchema[];
            actionDefItem = actionDefAllOf.find((b) => b.properties);

            if (actionDef.hasOwnProperty('additionalProperties')) {
              delete actionDef.additionalProperties;
            }
          }
          else {
            actionDefItem = actionDef;
          }

          let actDefProps = actionDefItem.properties
          let requiredProps = actionDefItem.required as string[];

          let snippetTabstopId = 0;
          let snippetBodyItems = []
          snippetBodyItems.push("^\"" + actionName + "\"");

          for (let index = 0; index < requiredProps.length; index++) {
            const requiredPropName = requiredProps[index];

            if (requiredPropName !== "verb") {
              // get the property definition
              let requiredProp = actDefProps[requiredPropName] as any;

              let snippetTabstop = "";
              if (requiredProp.hasOwnProperty('pattern')) {
                let pattern = (requiredProp as any).pattern as string;
                if (pattern.startsWith(patternEnumStart) && pattern.endsWith(patternEnumEnd)) {
                  let p2 = pattern.replace(patternEnumStart, "").replace(patternEnumEnd, "");
                  let options = p2.split("|")
                  let propSnippets = [];
                  for (let index = 0; index < options.length; index++) {
                    const opt = options[index];
                    propSnippets.push({ label: opt, body: `${opt}` });
                  }
                  requiredProp.defaultSnippets = propSnippets;
                }
              }

              snippetTabstop = `"${requiredPropName}": "$${++snippetTabstopId}"`;
              snippetBodyItems.push(snippetTabstop);
              //snippetBodyItems.push("\"" + requiredPropName + "\": \"$" + ++snippetTabstopId + "\"")
            }
          }

          let actionSnippet = {
            label: actionName,
            body: snippetBodyItems.join(",\n")
          }

          actionItemsSnippets.push(actionSnippet);

        }
      }

      let ai2 = actionItems as any;
      ai2.defaultSnippets = actionItemsSnippets;

      await this.storeData(schema, SiteActionSchema.LocalSchemaFilename);

      this.outputChannel.appendLine("schema refresh complete");
    } catch (error) {
      this.outputChannel.appendLine(error);
      if (this.configuration.allowTelemetry && this.context.extensionMode === vscode.ExtensionMode.Production) {
        AppInsights.defaultClient.trackException(error);
      }
    }
  }

}
