import * as vscode from 'vscode';
import { Foam, FoamWorkspace, ResourceParser, URI } from 'foam-core';
import { FoamFeature } from '../types';
import { mdDocSelector } from '../utils';
import { getFoamVsCodeConfig } from '../services/config';

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    if (!getFoamVsCodeConfig('links.navigation.enable')) {
      return;
    }

    const foam = await foamPromise;

    context.subscriptions.push(
      vscode.languages.registerReferenceProvider(
        mdDocSelector,
        new ReferenceProvider()
      )
    );

  },
};

export class ReferenceProvider implements vscode.ReferenceProvider {
	provideReferences(
			document: vscode.TextDocument,
			position: vscode.Position,
			context: vscode.ReferenceContext,
			token: vscode.CancellationToken
		): vscode.ProviderResult<vscode.Location[]> {

		console.log('=== document ===')
		console.log(document)

		console.log('=== position ===')
		console.log(position)

		console.log('=== context ===')
		console.log(context)

		// return [
		// 	{
		// 		uri:vscode.Uri.file('/home/jonas/Projects/ContribOpenSource/foam-template-master/inbox.md'),
		// 		range:new vscode.Range(
		// 			new vscode.Position(4, 17),
		// 			new vscode.Position(4, 23),
		// 			)
		// 	},
		// 	{
		// 		uri:vscode.Uri.file('/home/jonas/Projects/ContribOpenSource/foam-template-master/getting-started.md'),
		// 		range:new vscode.Range(
		// 			new vscode.Position(28, 20),
		// 			new vscode.Position(28, 26),
		// 			)
		// 	}
		// ]

		return;
	}

}

export default feature;

