import * as vscode from 'vscode';
import { Foam, FoamWorkspace, ResourceParser, URI } from 'foam-core';
import { FoamFeature } from '../types';
import { mdDocSelector } from '../utils';
import { OPEN_COMMAND } from './utility-commands';
import { toVsCodeRange, toVsCodeUri } from '../utils/vsc-utils';
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
      vscode.languages.registerDocumentLinkProvider(
        mdDocSelector,
        new LinkProvider(foam.workspace, foam.services.parser)
      )
    );
  },
};

export class LinkProvider implements vscode.DocumentLinkProvider {
  constructor(
    private workspace: FoamWorkspace,
    private parser: ResourceParser
  ) {}

  public provideDocumentLinks(
    document: vscode.TextDocument
  ): vscode.DocumentLink[] {

    console.log('===>>> provideDocumentLinks')

    const resource = this.parser.parse(document.uri, document.getText());

    let x = 1

    return resource.links.map(link => {
      const target = this.workspace.resolveLink(resource, link);
      const command = OPEN_COMMAND.asURI(toVsCodeUri(target));
      const documentLink = new vscode.DocumentLink(
        toVsCodeRange(link.range),
        command
      );
      x=x+1
      documentLink.tooltip = URI.isPlaceholder(target)
        ? `Create note for '${target.path}'`
        : `Go titi ${x} ${URI.toFsPath(target)}`;
      return documentLink;
    });
  }
}

export default feature;


//TODO: tester l'autre extension, voir comment la creation de fichier se passe avec un DefinitionProvider