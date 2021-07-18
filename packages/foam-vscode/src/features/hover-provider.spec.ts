import * as vscode from 'vscode';
import { FoamWorkspace, createMarkdownParser, URI } from 'foam-core';
import {
  cleanWorkspace,
  closeEditors,
  createFile,
  createTestWorkspace,
  showInEditor,
} from '../test/test-utils';
import { LinkProvider } from './document-link-provider';
import { HoverProvider } from './hover-provider';
import { OPEN_COMMAND } from './utility-commands';
import { toVsCodeUri } from '../utils/vsc-utils';

describe('Hover provider', () => {
  const parser = createMarkdownParser([]);

  beforeAll(async () => {
    await cleanWorkspace();
  });

  afterAll(async () => {
    await cleanWorkspace();
  });

  beforeEach(async () => {
    await closeEditors();
  });

  it('should not return hover content for empty documents', async () => {
    const { uri, content } = await createFile('');
    const ws = new FoamWorkspace().set(parser.parse(uri, content));

    const provider = new HoverProvider(ws, parser);

    const doc = await vscode.workspace.openTextDocument(uri);
    const pos = new vscode.Position(0, 0);
    const result: vscode.ProviderResult<vscode.Hover> = provider.provideHover(doc, pos, noCancelToken);

    expect(result).toBeUndefined();
  });

  it('should not return hover content for documents without links', async () => {
    const { uri, content } = await createFile('This is some content without links');
    const ws = new FoamWorkspace().set(parser.parse(uri, content));

    const provider = new HoverProvider(ws, parser);

    const doc = await vscode.workspace.openTextDocument(uri);
    const pos = new vscode.Position(0, 0);
    const result: vscode.ProviderResult<vscode.Hover> = provider.provideHover(doc, pos, noCancelToken);

    expect(result).toBeUndefined();
  });

  it('should return hover content for a wikilink', async () => {
    const fileB = await createFile('# File B\nThe content of file B');
    const fileA = await createFile(`this is a link to [[${fileB.name}]] end of the line.`);
    const noteA = parser.parse(fileA.uri, fileA.content);
    const noteB = parser.parse(fileB.uri, fileB.content);
    const ws = createTestWorkspace()
      .set(noteA)
      .set(noteB);

    const provider = new HoverProvider(ws, parser);
    const { doc } = await showInEditor(noteA.uri);
    const pos = new vscode.Position(0, 22); // Set cursor position on the wikilink.

    const result: vscode.Hover = provider.provideHover(doc, pos, noCancelToken) as vscode.Hover;

    expect(result.contents.length).toEqual(1);
    const mdResult = result.contents[0] as vscode.MarkdownString;
    expect(mdResult.value).toEqual('\n```markdown\n'+fileB.content+'\n```\n');
    expect(mdResult.isTrusted).toBeFalsy();
  });

  it('should not return hover content when the cursor is not placed on a wikilink', async () => {
    const fileB = await createFile('# File B\nThe content of file B');
    const fileA = await createFile(`this is a link to [[${fileB.name}]] end of the line.`);
    const noteA = parser.parse(fileA.uri, fileA.content);
    const noteB = parser.parse(fileB.uri, fileB.content);
    const ws = createTestWorkspace()
      .set(noteA)
      .set(noteB);

    const provider = new HoverProvider(ws, parser);
    const { doc } = await showInEditor(noteA.uri);
    const pos = new vscode.Position(0, 11); // Set cursor position beside the wikilink.

    const result: vscode.ProviderResult<vscode.Hover> = provider.provideHover(doc, pos, noCancelToken);
    expect(result).toBeUndefined();
  });

  it('should not return hover content for a regular link', async () => {
    const fileB = await createFile('# File B\nThe content of file B');
    const fileA = await createFile(`this is a link to [a file](./${fileB.base}).`);
    const noteA = parser.parse(fileA.uri, fileA.content);
    const noteB = parser.parse(fileB.uri, fileB.content);
    const ws = createTestWorkspace()
      .set(noteA)
      .set(noteB);

    const provider = new HoverProvider(ws, parser);
    const { doc } = await showInEditor(noteA.uri);
    const pos = new vscode.Position(0, 22); // Set cursor position on the wikilink.

    const result: vscode.ProviderResult<vscode.Hover> = provider.provideHover(doc, pos, noCancelToken);
    expect(result).toBeUndefined();
  });

  it('should not return hover content for a placeholder', async () => {
    const fileA = await createFile(`this is a link to [[a placeholder]] end of the line.`);
    const noteA = parser.parse(fileA.uri, fileA.content);
    const ws = createTestWorkspace()
      .set(noteA);

    const provider = new HoverProvider(ws, parser);
    const { doc } = await showInEditor(noteA.uri);
    const pos = new vscode.Position(0, 22); // Set cursor position on the placeholder.

    const result: vscode.ProviderResult<vscode.Hover> = provider.provideHover(doc, pos, noCancelToken);
    expect(result).toBeUndefined();  });
});

const noCancelToken:  vscode.CancellationToken = {
  isCancellationRequested: false,
  onCancellationRequested: null
};