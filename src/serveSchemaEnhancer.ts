import * as vscode from 'vscode';
import $RefParser = require("json-schema-ref-parser");
import TelemetryReporter from "vscode-extension-telemetry";
import Logger from "./logger";
import { ISchemaEnhancer } from "./ISchemaEnhancer";
import { Utilities } from "./utilities";

export class ServeSchemaEnhancer implements ISchemaEnhancer {
  public get localFilename(): string {
    return "serve.schema.json";
  }

  public get configurationKey(): string {
    return "serveSchemaUrl";
  }

  public async enhance(schemaUrl: string, localFileUri: vscode.Uri, reporter: TelemetryReporter, logger: Logger): Promise<void> {
    try {
      const schema = await $RefParser.parse(schemaUrl);
      logger.info(`schema downloaded ${schemaUrl}`);

      // add our definitions to the schema

      let customActionDetails: $RefParser.JSONSchema = {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "CustomAction type, or location of commands",
            defaultSnippets: [
              {
                "description": "Application Customizer extension",
                "body": "ClientSideExtension.ApplicationCustomizer"
              },
              {
                "description": "The context menu of the item(s)",
                "body": "ClientSideExtension.ListViewCommandSet.ContextMenu"
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
        "description": "'gulp serve' configuration",
        "properties": {
          "pageUrl": {
            "type": "string",
            "description": "URL of the modern page that should be used to test the extension"
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

      let serveConfigurations: $RefParser.JSONSchema = {
        "type": "object",
        "description": "Configuration objects used as the '--config' parameter for local testing",
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

      await Utilities.saveFile(schema, localFileUri);

      logger.info("schema refresh complete");
    } catch (error) {
      logger.info(error);
      reporter.sendTelemetryException(error);
    }
  }
  
}