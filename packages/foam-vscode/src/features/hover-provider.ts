import * as vscode from 'vscode';
import { Foam, FoamWorkspace, ResourceParser, URI, Range } from 'foam-core';
import { FoamFeature } from '../types';
import { mdDocSelector } from '../utils';
import { toVsCodeRange } from '../utils/vsc-utils';
import { ResourceLink } from 'foam-core';

const feature: FoamFeature = {
  activate: async (
    context: vscode.ExtensionContext,
    foamPromise: Promise<Foam>
  ) => {
    const foam = await foamPromise;

    context.subscriptions.push(
      vscode.languages.registerHoverProvider(
        mdDocSelector,
        new HoverProvider(foam.workspace, foam.services.parser)
      )
    );
  },
};

export class HoverProvider implements vscode.HoverProvider {
  constructor(
    private workspace: FoamWorkspace,
    private parser: ResourceParser
  ) {}

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    console.log('*** In HoverProvider ***'); //TO REMOVE

    const startResource = this.parser.parse(document.uri, document.getText());
    console.log(startResource);

    const targetLink: ResourceLink | undefined = startResource.links.find(
      link =>
        link.type === 'wikilink' &&
        Range.containsPosition(link.range, {
          line: position.line,
          character: position.character,
        })
    );

    if (!targetLink) {
      console.log('NO link'); //TO REMOVE
      return;
    }

    console.log('COntinue...');

    const uri = this.workspace.resolveLink(startResource, targetLink);

    if (URI.isPlaceholder(uri)) {
      console.log('Is placeholder ', uri.path);
      return;
    }

    const targetResource = this.workspace.get(uri);

    const md = new vscode.MarkdownString();
    md.appendCodeblock(targetResource.source.text, 'markdown');

    const hover: vscode.Hover = {
      contents: [md],
      range: toVsCodeRange(targetLink.range),
    };
    return hover;
  }
}

export default feature;
