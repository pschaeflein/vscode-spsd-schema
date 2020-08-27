import * as vscode from 'vscode';
import * as chalk from 'chalk';
import * as AppInsights from 'applicationinsights';
import { ISiteDesignSchemaConfiguration } from './ISiteDesignSchemaConfiguration';
import { SiteActionSchema, } from './siteActionsSchema';
import { Utilities, LocalSchemaStatus } from './utilities';
import { ServeSchema } from './serveSchema';

let extConfiguration: ISiteDesignSchemaConfiguration;
let extensionPath: vscode.Uri;
let pkgVersion: string;

let outputChannel: vscode.OutputChannel
const log = (message: string) => {
  outputChannel.appendLine(message)
}

const logger = {
  info: (message: string) => log(`${chalk.black.bgWhite.bold(' INFO ')} ${message}`),
  warn: (message: string) => log(`${chalk.black.bgYellow.bold(' WARN ')} ${message}`),
  error: (message: string) => log(`${chalk.white.bgRed.bold(' ERROR ')} ${message}`)
}


export async function activate(context: vscode.ExtensionContext) {
  // create a log channel
  outputChannel = vscode.window.createOutputChannel('spfx-schema')
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

  // check the files..
  let siteActionFileStatus = await Utilities.getLocalFileStatus(vscode.Uri.joinPath(context.extensionUri, SiteActionSchema.LocalSchemaFilename));
  let performRefresh = (siteActionFileStatus != LocalSchemaStatus.current);
  
  let localStatusMessage = `Local Site Action schema status: ${LocalSchemaStatus[siteActionFileStatus]}`;
  (siteActionFileStatus === LocalSchemaStatus.current) 
    ? logger.info(localStatusMessage)
    : logger.warn(localStatusMessage);
    
  if (performRefresh) {
    await SiteActionSchema.getAndRefreshSchema(extConfiguration.schemaUrl, outputChannel, storeData);
  }

  if (extConfiguration.allowTelemetry) {
    let eventProps = {
      schema: SiteActionSchema.LocalSchemaFilename,
      refresh: performRefresh,
      status: LocalSchemaStatus[siteActionFileStatus]
    };
    AppInsights.defaultClient.trackEvent({ name: 'activate-extension', properties: eventProps });
  }

  let serveFileStatus = await Utilities.getLocalFileStatus(vscode.Uri.joinPath(context.extensionUri, ServeSchema.LocalSchemaFilename));
  performRefresh = (serveFileStatus != LocalSchemaStatus.current);

  localStatusMessage = `Local serve schema status: ${LocalSchemaStatus[serveFileStatus]}`;
  (serveFileStatus === LocalSchemaStatus.current)
    ? logger.info(localStatusMessage)
    : logger.warn(localStatusMessage);

  if (performRefresh) {
    await ServeSchema.getAndRefreshSchema(extConfiguration.serveSchemaUrl, outputChannel, storeData);
  }

  if (extConfiguration.allowTelemetry) {
    let eventProps = {
      schema: ServeSchema.LocalSchemaFilename,
      refresh: performRefresh,
      status: LocalSchemaStatus[serveFileStatus]
    };
    AppInsights.defaultClient.trackEvent({ name: 'activate-extension', properties: eventProps });
  }


  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand('sitedesign-schema.refreshSchema', () => {
    SiteActionSchema.getAndRefreshSchema(extConfiguration.schemaUrl, outputChannel, storeData);

    // Display a message box to the user
    vscode.window.showInformationMessage('Refresh queued');
 
    if (extConfiguration.allowTelemetry) {
      let eventProps = {
        schema: ServeSchema.LocalSchemaFilename,
        refresh: true,
        status: LocalSchemaStatus[siteActionFileStatus]
      };
      AppInsights.defaultClient.trackEvent({ name: 'sitedesign-schema.refreshSchema', properties: eventProps });
    }

  });

  disposable = vscode.commands.registerCommand('sitedesign-schema.refreshServeSchema', () => {
    ServeSchema.getAndRefreshSchema(extConfiguration.serveSchemaUrl, outputChannel, storeData);

    // Display a message box to the user
    vscode.window.showInformationMessage('Refresh queued');

    if (extConfiguration.allowTelemetry) {
      let eventProps = {
        schema: ServeSchema.LocalSchemaFilename,
        refresh: true,
        status: LocalSchemaStatus[serveFileStatus]
      };
      AppInsights.defaultClient.trackEvent({ name: 'sitedesign-schema.refreshServeSchema', properties: eventProps });
    }

  });

  // Example: Listening to configuration changes
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {

    if (e.affectsConfiguration('sitedesign-schema')) {
      logger.info("Reloading configuration");
      extConfiguration = vscode.workspace.getConfiguration().get<ISiteDesignSchemaConfiguration>('sitedesign-schema');

      // TODO: Refactor so all the work in activate is handled in different functions.
      //       That way I can re-run them on config change...


    }

  }));

  context.subscriptions.push(disposable);
}

async function storeData(schema: any, schemaFilePath: string) {
  let localSchemaFilepath = vscode.Uri.joinPath(extensionPath, schemaFilePath);
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
