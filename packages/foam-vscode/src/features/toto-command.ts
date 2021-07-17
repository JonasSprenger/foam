import * as vscode from 'vscode';
import { FoamFeature } from '../types';

const feature: FoamFeature = {
  activate: (context: vscode.ExtensionContext) => {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'foam-vscode.toto',
        () => {
          console.log('*** TOTO TOTO TOTO ***')
          vscode.window.showInformationMessage('TOTO')
        }
      )
    );
  },
};

export default feature;