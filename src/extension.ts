import * as vscode from 'vscode';
import * as chalk from 'chalk';
import * as $RefParser from 'json-schema-ref-parser';

const schemaUrl = "https://developer.microsoft.com/json-schemas/sp/site-design-script-actions.schema.json"
const schemaFilename = "sharepoint.sitescript.json"
const msInAWeek = 604800000;
let extensionPath: vscode.Uri;
let localFilepath: vscode.Uri;
const patternEnumStart = "^(";
const patternEnumEnd = ")$";

let outputChannel: vscode.OutputChannel
const log = (message: string) => {
  outputChannel.appendLine(message)
  outputChannel.show(true)
}

const logger = {
  info: (message: string) => log(`${chalk.black.bgWhite.bold(' INFO ')} ${message}`),
  warn: (message: string) => log(`${chalk.black.bgYellow.bold(' WARN ')} ${message}`),
  error: (message: string) => log(`${chalk.white.bgRed.bold(' ERROR ')} ${message}`)
}

export async function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('sitedesign-schema')
  context.subscriptions.push(outputChannel)

  extensionPath = context.extensionUri
  localFilepath = vscode.Uri.joinPath(extensionPath, schemaFilename)
  // if local file not found, or is a week old, refresh it
  const stat = await vscode.workspace.fs.stat(localFilepath);
  if (stat) {
    let age = new Date().getTime() - stat.mtime;
    if (age > msInAWeek) {
      logger.warn("schema is old");
      getAndRefreshSchema();
    }
    else {
      logger.info("local schema is current");

    }
  }
  else {
    logger.error("local schema not found");
    getAndRefreshSchema();
  }


  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand('sitedesign-schema.refreshSchema', () => {
    getAndRefreshSchema();

    // Display a message box to the user
    vscode.window.showInformationMessage('Refresh queued');
  });

  context.subscriptions.push(disposable);
}

async function getAndRefreshSchema() {
  try {
    const schema = await $RefParser.parse(schemaUrl);
    logger.info("schema downloaded");

    const baseAction = schema.definitions["baseAction"] as $RefParser.JSONSchema;
    const baseActionVerb = baseAction.properties["verb"] as $RefParser.JSONSchema;

    let baseActionVerbSnippets = [];

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

        baseActionVerbSnippets.push(actionSnippet);

      }
    }

    let bav2 = baseActionVerb as any;
    bav2.defaultSnippets = baseActionVerbSnippets;

    await storeData(schema);

    logger.info("schema refresh complete");
  } catch (error) {
    logger.error(error);
  }
}

async function storeData(schema: any) {
  const writeData = Buffer.from(JSON.stringify(schema, null, 2), 'utf8')
  await vscode.workspace.fs.writeFile(localFilepath, writeData);
}


// this method is called when your extension is deactivated
export function deactivate() { }
