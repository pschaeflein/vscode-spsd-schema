import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import Logger from './logger';

import { Utilities, LocalSchemaStatus } from './utilities';
import { ISchemaEnhancer } from './ISchemaEnhancer';
import { SiteActionSchemaEnhancer } from './siteActionSchemaEnhancer';
import { ServeSchemaEnhancer } from './serveSchemaEnhancer';

let configSection: vscode.WorkspaceConfiguration;
let extensionPath: vscode.Uri;
let reporter: TelemetryReporter;
let logger: Logger;

/*
 *  Update this with new enhancers
 */
let schemaFilesToProcess: ISchemaEnhancer[] = [
  new SiteActionSchemaEnhancer(),
  new ServeSchemaEnhancer()
];


export async function activate(context: vscode.ExtensionContext) {
  // get info about extension
  extensionPath = context.extensionUri
  const pkgData = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(extensionPath, "package.json"));
  let pkg = JSON.parse(Buffer.from(pkgData).toString('utf8'));

  // create telemetry reporter 
  reporter = new TelemetryReporter(pkg.name, pkg.version, "9b0d2858-d71c-494d-a19a-ee9950352bdf");
  reporter.sendTelemetryEvent("activate-extension");
  // ensure it gets property disposed
  context.subscriptions.push(reporter);

  // create an output channel
  logger = new Logger();
  // ensure it gets property disposed
  context.subscriptions.push(logger);
  
  // get the user-editable configuration
  configSection = vscode.workspace.getConfiguration('sitedesign-schema');

  schemaFilesToProcess.map((enhancer, index) => checkSchema(context.extensionUri, configSection, enhancer));


  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand('sitedesign-schema.refreshSchema', () => {
    reporter.sendTelemetryEvent("sitedesign-schema.refreshSchema");
    checkSchema(context.extensionUri, configSection, new SiteActionSchemaEnhancer())
    vscode.window.showInformationMessage('Refresh complete');
  });

  disposable = vscode.commands.registerCommand('sitedesign-schema.refreshServeSchema', () => {
    reporter.sendTelemetryEvent("sitedesign-schema.refreshServeSchema");
    checkSchema(context.extensionUri, configSection, new ServeSchemaEnhancer())
    vscode.window.showInformationMessage('Refresh complete');
  });

  // Example: Listening to configuration changes
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {

    if (e.affectsConfiguration('sitedesign-schema')) {
      logger.info("Reloading configuration");
      configSection = vscode.workspace.getConfiguration('sitedesign-schema');

      // check the files..
      schemaFilesToProcess.map((enhancer, index) => checkSchema(context.extensionUri, configSection, enhancer, true));
    }

  }));

  context.subscriptions.push(disposable);
}

async function checkSchema(extensionUri: vscode.Uri, configSection: vscode.WorkspaceConfiguration, enhancer: ISchemaEnhancer, forceUpdate: boolean = false) {
  let localFileUri = vscode.Uri.joinPath(extensionUri, enhancer.localFilename)
  let status = await Utilities.getLocalFileStatus(localFileUri);

  if (status !== LocalSchemaStatus.current) {
    let schemaUrl = configSection.get<string>(enhancer.configurationKey);
    await enhancer.enhance(schemaUrl, localFileUri, reporter, logger);
  }
}

// this method is called when your extension is deactivated
export function deactivate() { 
}
