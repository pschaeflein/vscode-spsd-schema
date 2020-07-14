import * as vscode from 'vscode';
import * as chalk from 'chalk';
import * as $RefParser from 'json-schema-ref-parser';
import * as AppInsights from 'applicationinsights';
import { ISiteDesignSchemaConfiguration } from './ISiteDesignSchemaConfiguration';

const schemaFilename = "sitescript.schema.json"
const msInAWeek = 604800000;
const patternEnumStart = "^(";
const patternEnumEnd = ")$";

let extConfiguration: ISiteDesignSchemaConfiguration;
//const schemaUrl = "https://developer.microsoft.com/json-schemas/sp/site-design-script-actions.schema.json"
let schemaUrl: string = "";
let extensionPath: vscode.Uri;
let localSchemaFilepath: vscode.Uri;
let pkgVersion: string;

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

enum LocalSchemaStatus {
  unknown,
  current,
  outOfDate,
  missing
}

export async function activate(context: vscode.ExtensionContext) {
  // create a log channel
  outputChannel = vscode.window.createOutputChannel('sitedesign-schema')
  context.subscriptions.push(outputChannel)

  // get info about extension
  extensionPath = context.extensionUri
  const pkgData = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(extensionPath, "package.json"));
  let pkg = JSON.parse(Buffer.from(pkgData).toString('utf8'));
  pkgVersion = pkg.version;

  // get the user-editable configuration
  extConfiguration = vscode.workspace.getConfiguration().get<ISiteDesignSchemaConfiguration>('sitedesign-schema');


  if (extConfiguration.allowTelemetry) {
    setupAppInsights();
  }

  let performRefresh = false;
  let status: LocalSchemaStatus = LocalSchemaStatus.unknown;

  localSchemaFilepath = vscode.Uri.joinPath(extensionPath, schemaFilename)

  const stat = await vscode.workspace.fs.stat(localSchemaFilepath);
  if (stat) {
    let age = new Date().getTime() - stat.mtime;
    if (age > msInAWeek) {
      performRefresh = true;
      status = LocalSchemaStatus.outOfDate;
    }
    else {
      status = LocalSchemaStatus.current;
    }
  }
  else {
    performRefresh = true;
    status = LocalSchemaStatus.missing;
  }

  let localStatusMessage = `Local schema status: ${LocalSchemaStatus[status]}`;
  (status === LocalSchemaStatus.current) 
    ? logger.info(localStatusMessage)
    : logger.warn(localStatusMessage);
    
  if (performRefresh) {
    getAndRefreshSchema(extConfiguration.schemaUrl);
  }

  if (extConfiguration.allowTelemetry) {
    let eventProps = {
      refresh: performRefresh,
      status: LocalSchemaStatus[status]
    };
    AppInsights.defaultClient.trackEvent({ name: 'activate-extension', properties: eventProps });
  }


  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand('sitedesign-schema.refreshSchema', () => {
    getAndRefreshSchema(extConfiguration.schemaUrl);

    // Display a message box to the user
    vscode.window.showInformationMessage('Refresh queued');
 
    if (extConfiguration.allowTelemetry) {
      let eventProps = {
        refresh: true,
        status: LocalSchemaStatus[status]
      };
      AppInsights.defaultClient.trackEvent({ name: 'sitedesign-schema.refreshSchema', properties: eventProps });
    }

  });

  // Example: Listening to configuration changes
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {

    if (e.affectsConfiguration('sitedesign-schema')) {
      logger.info("Reloading configuration");
      extConfiguration = vscode.workspace.getConfiguration().get<ISiteDesignSchemaConfiguration>('sitedesign-schema');
    }

  }));

  context.subscriptions.push(disposable);
}

async function getAndRefreshSchema(schemaUrl: string) {
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
  await vscode.workspace.fs.writeFile(localSchemaFilepath, writeData);
}

function setupAppInsights() {
  AppInsights.setup('9b0d2858-d71c-494d-a19a-ee9950352bdf');
  //delete AppInsights.defaultClient.context.tags['ai.cloud.roleInstance'];
  AppInsights.Configuration.setAutoCollectExceptions(true);
  AppInsights.Configuration.setAutoCollectPerformance(true);
  AppInsights.defaultClient.commonProperties = {
    extVersion: pkgVersion,
    vsVersion: vscode.version
  };
}

// this method is called when your extension is deactivated
export function deactivate() { }
