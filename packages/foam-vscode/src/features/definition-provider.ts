import * as vscode from 'vscode';
import { Foam, FoamWorkspace, ResourceParser, URI, Range } from 'foam-core';
import { FoamFeature } from '../types';
import { mdDocSelector, createNoteFromPlaceholder } from '../utils';
import { OPEN_COMMAND } from './utility-commands';
import { toVsCodeRange, toVsCodePosition, toVsCodeUri } from '../utils/vsc-utils';
import { getFoamVsCodeConfig } from '../services/config';
import { ResourceLink } from 'foam-core';

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {

    const foam = await foamPromise;

    // context.subscriptions.push(
    //   vscode.languages.registerDefinitionProvider(
    //     mdDocSelector,
    //     new DefinitionProvider(foam.workspace, foam.services.parser)
    //   )
    // );

    context.subscriptions.push(
      vscode.languages.registerHoverProvider(
        mdDocSelector,
        new HoverProvider()
      )
    );

  },
};

export class DefinitionProvider implements vscode.DefinitionProvider {
  constructor(
    private workspace: FoamWorkspace,
    private parser: ResourceParser // Foam-core
  ) {}

  public provideDefinition (
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.LocationLink[] | vscode.Definition> {

    console.log("*** In DefinitionProvider ***");

    console.log('document: ', document)
    console.log('position: ', position)

    this.workspace

    const resource = this.parser.parse(document.uri, document.getText());
    console.log(resource)

    const targetLink: ResourceLink | undefined = resource.links.find(link =>
        link.type === 'wikilink' &&
        Range.containsPosition(link.range, {line: position.line, character: position.character})
      )

    if(!targetLink) {
      return;
    }

    const uri = this.workspace.resolveLink(resource, targetLink)
    if(URI.isPlaceholder(uri)) {
      console.log("Creating new file at: ", uri.path)
      createNoteFromPlaceholder(uri)  //Check await!!! How it's work?! The probleme is that the file is created on over...
    }

    const res1: vscode.LocationLink[] = [{
      originSelectionRange: toVsCodeRange(targetLink.range),
      targetUri: toVsCodeUri(uri),
      // Define the target range, but don't work properly with markdown.
      targetRange: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)),
      // Define selection at target location.
      targetSelectionRange: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 100)) //TODO: get range of the title.
    }]

    const res2: vscode.Location = {
      uri: toVsCodeUri(uri),
      range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(20, 0)),
    }

    return res1;

  }
}


export class HoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    const hover:vscode.Hover = {
      contents: [new vscode.MarkdownString('TOTO TITI TUTU', false)],
      range: new vscode.Range(5, 10, 5, 20)
    }
    return hover
  }

}

    // TODOs:
    // Try to get the range of the first header.

export default feature;
