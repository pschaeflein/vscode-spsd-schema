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

  public static async saveFile(data: any, fileUri: vscode.Uri): Promise<void> {
    const writeData = Buffer.from(JSON.stringify(data, null, 2), 'utf8')
    return vscode.workspace.fs.writeFile(fileUri, writeData);
  }
}

export enum LocalSchemaStatus {
  unknown,
  current,
  outOfDate,
  missing
}
