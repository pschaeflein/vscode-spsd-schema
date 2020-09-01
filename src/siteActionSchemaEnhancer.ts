import * as vscode from 'vscode';
import { ISchemaEnhancer } from "./ISchemaEnhancer";
import TelemetryReporter from "vscode-extension-telemetry";
import Logger from "./logger";
import $RefParser = require("json-schema-ref-parser");
import { Utilities } from "./utilities";

export class SiteActionSchemaEnhancer implements ISchemaEnhancer {

  public get localFilename(): string {
    return "sitescript.schema.json";
  }

  public get configurationKey(): string {
    return "schemaUrl"
  }
  public async enhance(schemaUrl: string, localFileUri: vscode.Uri, reporter: TelemetryReporter, logger: Logger): Promise<void> {

    const patternEnumStart = "^(";
    const patternEnumEnd = ")$";

    try {
      const schema = await $RefParser.parse(schemaUrl);
      logger.info(`schema downloaded ${schemaUrl}`);

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

      await Utilities.saveFile(schema, localFileUri);

      logger.info("schema refresh complete");
    } catch (error) {
      logger.info(error);
      reporter.sendTelemetryException(error);
    }

    return Promise.resolve();
  }

}