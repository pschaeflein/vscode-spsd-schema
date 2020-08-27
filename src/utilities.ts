import * as vscode from 'vscode';

export class Utilities {
  private static msInAWeek = 604800000;

  public static async getLocalFileStatus(schemaLocalFilepath: vscode.Uri): Promise<LocalSchemaStatus> {
    let status: LocalSchemaStatus = LocalSchemaStatus.unknown;

    try {
      const stat = await vscode.workspace.fs.stat(schemaLocalFilepath);
      if (stat) {
        let age = new Date().getTime() - stat.mtime;
        if (age > this.msInAWeek) {
          status = LocalSchemaStatus.outOfDate;
        }
        else {
          status = LocalSchemaStatus.current;
        }
      }
      else {
        status = LocalSchemaStatus.missing;
      }
    }
    catch (error) {

    }

    return Promise.resolve(status);
  }
}

export enum LocalSchemaStatus {
  unknown,
  current,
  outOfDate,
  missing
}
