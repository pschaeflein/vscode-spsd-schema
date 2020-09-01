// thanks to https://github.com/johnpapa/vscode-peacock

import { OutputChannel, window } from 'vscode';

export default class Logger {
  private _outputChannel: OutputChannel;

  constructor() {
    this.initialize();
  }

  private initialize() {
    if (!this._outputChannel) {
      // Only init once
      this._outputChannel = window.createOutputChannel('SPFx Schema');
    }
  }

  public dispose(){
    if (this._outputChannel) {
      this._outputChannel.dispose();
      this._outputChannel = null;
    }
  }

  public info(value: string | object | undefined, indent = false, title = '') {
    if (title) {
      this._outputChannel.appendLine(title);
    }
    const message = prepareMessage(value, indent);
    this._outputChannel.appendLine(message);
  }
}

function prepareMessage(value: string | object | undefined, indent: boolean) {
  const prefix = indent ? '  ' : '';
  let text = '';
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      text = `${prefix}${JSON.stringify(value, null, 2)}`;
    } else {
      Object.entries(value).map(item => {
        text += `${prefix}${item[0]} = ${item[1]}\n`;
      });
    }
    return text;
  }
  text = `${prefix}${value}`;
  return text;
}
