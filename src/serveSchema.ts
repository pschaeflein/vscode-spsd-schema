import * as vscode from 'vscode';
import * as $RefParser from 'json-schema-ref-parser';

export class ServeSchema {
  static LocalSchemaFilename: string = "serve.schema.json";

  public static async getAndRefreshSchema(schemaUrl: string, outputChannel: vscode.OutputChannel, storeData: (schema: any, schemaFilePath: string) => Promise<void>) {
    const patternEnumStart = "^(";
    const patternEnumEnd = ")$";

    try {
      const schema = await $RefParser.parse(schemaUrl);
      outputChannel.appendLine("schema downloaded");

      // add our definitions to the schema

      let customActionDetails: $RefParser.JSONSchema = {
        type: "object",
        properties: {
          location: {
            type: "string"
          },
          properties: {
            type: "object"
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
            oneOf: [
              { "$ref": "#/definitions/customActionDetails" }
            ]
          }
        }
      };

      let serveConfiguration: $RefParser.JSONSchema = {
        "type": "object",
        "properties": {
          "pageUrl": {
            "type": "string"
          },
          "customActions": {
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
        "serveConfigurations": {
          "oneOf": [
            {
              "$ref": "#/definitions/serveConfigurations"
            }
          ]
        },
      };


      await storeData(schema, this.LocalSchemaFilename);

      outputChannel.appendLine("schema refresh complete");
    } catch (error) {
      outputChannel.appendLine(error);
    }
  }
}