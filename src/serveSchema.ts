import * as vscode from 'vscode';
import * as AppInsights from 'applicationinsights';
import * as $RefParser from 'json-schema-ref-parser';
import { ISiteDesignSchemaConfiguration } from './ISiteDesignSchemaConfiguration';
import { Utilities, LocalSchemaStatus } from './utilities';

export class ServeSchema {
  static LocalSchemaFilename: string = "serve.schema.json";

  private context: vscode.ExtensionContext;
  private configuration: ISiteDesignSchemaConfiguration;
  private outputChannel: vscode.OutputChannel;
  private storeData: (schema: any, schemaFilePath: string) => Promise<void>;

  public constructor(context: vscode.ExtensionContext, configuration: ISiteDesignSchemaConfiguration, outputChannel: vscode.OutputChannel, storeData: (schema: any, schemaFilePath: string) => Promise<void>) {
    this.context = context;
    this.configuration = configuration;
    this.outputChannel = outputChannel;
    this.storeData = storeData;
  }

  public async checkSchemaFile() {
    let siteActionFileStatus = await Utilities.getLocalFileStatus(vscode.Uri.joinPath(this.context.extensionUri, ServeSchema.LocalSchemaFilename));
    let performRefresh = (siteActionFileStatus != LocalSchemaStatus.current);

    let localStatusMessage = `Local Serve schema status: ${LocalSchemaStatus[siteActionFileStatus]}`;
    this.outputChannel.appendLine(localStatusMessage);

    if (performRefresh) {
      await this.getAndRefreshSchema();  //extConfiguration.schemaUrl, this.outputChannel, storeData
    }

    if (this.configuration.allowTelemetry && this.context.extensionMode === vscode.ExtensionMode.Production) {
      let eventProps = {
        schema: ServeSchema.LocalSchemaFilename,
        refresh: performRefresh,
        status: LocalSchemaStatus[siteActionFileStatus]
      };
      AppInsights.defaultClient.trackEvent({ name: 'refresh-schema', properties: eventProps });
    }
  }

  public async getAndRefreshSchema() {

    try {
      const schema = await $RefParser.parse(this.configuration.serveSchemaUrl);
      this.outputChannel.appendLine("schema downloaded");

      // add our definitions to the schema

      let customActionDetails: $RefParser.JSONSchema = {
        type: "object",
        properties: {
          location: {
            type: "string",
            description:"CustomAction type, or location of commands",
            defaultSnippets: [
              {
                "description": "Application Customizer extension",
                "body": "ClientSideExtension.ApplicationCustomizer"
              },
              {
                "description":"The context menu of the item(s)",
                "body":"ClientSideExtension.ListViewCommandSet.ContextMenu"
              },
              {
                "description": "The top command set menu in a list or library",
                "body": "ClientSideExtension.ListViewCommandSet.CommandBar"
              },
              {
                "description": "Both the context menu and the command bar",
                "body": "ClientSideExtension.ListViewCommandSet"
              }
            ],
          },
          properties: {
            type: "object",
            description: "An optional JSON object containing properties that are available via the 'this.properties' member."
          }
        },
        required: [
          "location"
        ]
      };

      let customAction: $RefParser.JSONSchema = {
        type: "object",
        patternProperties: {
          "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$": {
            description: "Simulates a custom action. When you deploy and register this component in a site, you'll create this CustomAction object and describe all the different properties you can set on it.",
            oneOf: [
              { "$ref": "#/definitions/customActionDetails" }
            ]
          }
        }
      };

      let serveConfiguration: $RefParser.JSONSchema = {
        "type": "object",
        "description":"'gulp serve' configuration",
        "properties": {
          "pageUrl": {
            "type": "string",
            "description":"URL of the modern page that should be used to test the extension"
          },
          "customActions": {
            "description": "The list of extensions that should be loaded",
            "defaultSnippets": [
              {
                "label": "",
                "description": "GUID of the extension",
                "body": { "${1:Extension GUID}": { "location": "$2", "properties": {} } }
              }
            ],
            "$ref": "#/definitions/customAction"
          },
          "fieldCustomizers": {
            "type": "object"
          }
        },
        "additionalProperties": false,
        "oneOf": [
          {
            "required": [
              "customActions"
            ]
          },
          {
            "required": [
              "fieldCustomizers"
            ]
          }
        ],
        "required": [
          "pageUrl"
        ]
      };

      let serveConfigurations:$RefParser.JSONSchema = {
        "type": "object",
        "description":"Configuration objects used as the '--config' parameter for local testing",
        "patternProperties": {
          "[a-z]": {
            "allOf": [
              {
                "$ref": "#/definitions/serveConfiguration"
              }
            ]
          }
        }
      };



      let definitions: $RefParser.JSONSchema = {
        customActionDetails: customActionDetails,
        customAction: customAction,
        serveConfiguration: serveConfiguration,
        serveConfigurations: serveConfigurations
      };


      schema.definitions = definitions;

      schema.properties.serveConfigurations = {
        "oneOf": [
          {
            "$ref": "#/definitions/serveConfigurations"
          }
        ]
      };


      await this.storeData(schema, ServeSchema.LocalSchemaFilename);

      this.outputChannel.appendLine("schema refresh complete");
    } catch (error) {
      this.outputChannel.appendLine(error);
      if (this.configuration.allowTelemetry && this.context.extensionMode === vscode.ExtensionMode.Production) {
        AppInsights.defaultClient.trackException(error);
      }
    }
  }
}