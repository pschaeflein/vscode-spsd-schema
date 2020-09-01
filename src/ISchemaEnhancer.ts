import * as vscode from 'vscode';
import TelemetryReporter from "vscode-extension-telemetry";
import Logger from "./logger";

export interface ISchemaEnhancer {
  readonly localFilename: string;
  readonly configurationKey: string;
  enhance: (schemaUrl: string, localFileUri: vscode.Uri, reporter: TelemetryReporter, logger: Logger ) => Promise<void>;

}