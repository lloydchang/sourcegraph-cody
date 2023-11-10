/* eslint-disable @typescript-eslint/no-empty-function */
import * as fs from 'fs'
import * as fspromises from 'fs/promises'

import type * as vscode from 'vscode'

// <VERY IMPORTANT - PLEASE READ>
// This file must not import any module that transitively imports from 'vscode'.
// It's only OK to `import type` from vscode. We can't depend on any vscode APIs
// to implement this this file because this file is responsible for implementing
// VS Code APIs resulting in cyclic dependencies.  If we make a mistake and
// transitively import vscode then you are most likely to hit an error like this:
//
//     /pkg/prelude/bootstrap.js:1926
//     return wrapper.apply(this.exports, args);
//                    ^
//     TypeError: Cannot read properties of undefined (reading 'getConfiguration')
//     at Object.<anonymous> (/snapshot/dist/agent.js)
//     at Module._compile (pkg/prelude/bootstrap.js:1926:22)
// </VERY IMPORTANT>
import type { InlineCompletionItemProvider } from '../../vscode/src/completions/inline-completion-item-provider'
import {
    // It's OK to import the VS Code mocks because they don't depend on the 'vscode' module.
    Disposable,
    emptyDisposable,
    emptyEvent,
    EventEmitter,
    FileType,
    UIKind,
    Uri,
} from '../../vscode/src/testutils/mocks'

import type { Agent } from './agent'
import { AgentTabGroups } from './AgentTabGroups'
import type { ExtensionConfiguration } from './protocol-alias'

export {
    emptyEvent,
    emptyDisposable,
    Range,
    Location,
    Selection,
    Position,
    Disposable,
    CancellationTokenSource,
    EndOfLine,
    EventEmitter,
    InlineCompletionItem,
    InlineCompletionTriggerKind,
    WorkspaceEdit,
    QuickPickItemKind,
    ConfigurationTarget,
    StatusBarAlignment,
    RelativePattern,
    MarkdownString,
    ProgressLocation,
    CommentMode,
    CommentThreadCollapsibleState,
    OverviewRulerLane,
    CodeLens,
    CodeAction,
    CodeActionKind,
    FileType,
    ThemeColor,
    ThemeIcon,
    TreeItemCollapsibleState,
    TreeItem,
    ExtensionMode,
    DiagnosticSeverity,
    SymbolKind,
    ViewColumn,
    QuickInputButtons,
    UIKind,
    Uri,
} from '../../vscode/src/testutils/mocks'

const emptyFileWatcher: vscode.FileSystemWatcher = {
    onDidChange: emptyEvent(),
    onDidCreate: emptyEvent(),
    onDidDelete: emptyEvent(),
    ignoreChangeEvents: true,
    ignoreCreateEvents: true,
    ignoreDeleteEvents: true,
    dispose(): void {},
}

export let connectionConfig: ExtensionConfiguration | undefined
export function setConnectionConfig(newConfig: ExtensionConfiguration): void {
    connectionConfig = newConfig
}

export function isAuthenticationChange(newConfig: ExtensionConfiguration): boolean {
    if (!connectionConfig) {
        return true
    }

    return (
        connectionConfig.accessToken !== newConfig.accessToken ||
        connectionConfig.serverEndpoint !== newConfig.serverEndpoint
    )
}

export const customConfiguration: Record<string, any> = {}

const configuration: vscode.WorkspaceConfiguration = {
    has(section) {
        return true
    },
    get: (section, defaultValue?: any) => {
        switch (section) {
            case 'cody.serverEndpoint':
                return connectionConfig?.serverEndpoint
            case 'cody.proxy':
                return connectionConfig?.proxy ?? null
            case 'cody.customHeaders':
                return connectionConfig?.customHeaders
            case 'cody.telemetry.level':
                // Use the dedicated `graphql/logEvent` to send telemetry from
                // agent clients.  The reason we disable telemetry via config is
                // that we don't want to submit vscode-specific events when
                // running inside the agent.
                return 'off'
            case 'cody.autocomplete.enabled':
                return true
            case 'cody.autocomplete.advanced.provider':
                return connectionConfig?.autocompleteAdvancedProvider ?? null
            case 'cody.autocomplete.advanced.serverEndpoint':
                return connectionConfig?.autocompleteAdvancedServerEndpoint ?? null
            case 'cody.autocomplete.advanced.model':
                return connectionConfig?.autocompleteAdvancedModel ?? null
            case 'cody.autocomplete.advanced.accessToken':
                return connectionConfig?.autocompleteAdvancedAccessToken ?? null
            case 'cody.advanced.agent.running':
                return true
            case 'cody.debug.enable':
                return connectionConfig?.debug ?? false
            case 'cody.debug.verbose':
                return connectionConfig?.verboseDebug ?? false
            case 'cody.autocomplete.experimental.syntacticPostProcessing':
                // False because we don't embed WASM with the agent yet.
                return false
            case 'cody.codebase':
                return connectionConfig?.codebase
            default:
                return customConfiguration[section] ?? defaultValue
        }
    },
    update(section, value, configurationTarget, overrideInLanguage) {
        return Promise.resolve()
    },
    inspect(section) {
        return undefined
    },
}

export const onDidChangeActiveTextEditor = new EventEmitter<vscode.TextEditor | undefined>()
export const onDidChangeConfiguration = new EventEmitter<vscode.ConfigurationChangeEvent>()
export const onDidOpenTextDocument = new EventEmitter<vscode.TextDocument>()
export const onDidChangeTextDocument = new EventEmitter<vscode.TextDocumentChangeEvent>()
export const onDidCloseTextDocument = new EventEmitter<vscode.TextDocument>()
export const onDidSaveTextDocument = new EventEmitter<vscode.TextDocument>()
export const onDidRenameFiles = new EventEmitter<vscode.FileRenameEvent>()
export const onDidDeleteFiles = new EventEmitter<vscode.FileDeleteEvent>()

export interface WorkspaceDocuments {
    workspaceRootUri?: vscode.Uri
    openTextDocument: (filePath: string) => Promise<vscode.TextDocument>
}
let workspaceDocuments: WorkspaceDocuments | undefined
export function setWorkspaceDocuments(newWorkspaceDocuments: WorkspaceDocuments): void {
    workspaceDocuments = newWorkspaceDocuments
}

// vscode.workspace.onDidChangeConfiguration
const _workspace: Partial<typeof vscode.workspace> = {
    openTextDocument: uri => {
        // We currently treat filePath the same as uri for now, but will need to
        // properly pass around URIs once the agent protocol supports URIs
        const filePath = uri instanceof Uri ? uri.path : uri?.toString() ?? ''
        return workspaceDocuments ? workspaceDocuments.openTextDocument(filePath) : ('missingWorkspaceDocuments' as any)
    },
    getWorkspaceFolder: () => {
        if (workspaceDocuments?.workspaceRootUri === undefined) {
            throw new Error(
                'workspaceDocuments is undefined. To fix this problem, make sure that the agent has been initialized.'
            )
        }
        return {
            uri: workspaceDocuments.workspaceRootUri,
            index: 0,
            name: workspaceDocuments.workspaceRootUri?.path,
        }
    },
    onDidChangeWorkspaceFolders: (() => ({})) as any,
    onDidOpenTextDocument: onDidOpenTextDocument.event,
    onDidChangeConfiguration: onDidChangeConfiguration.event,
    onDidChangeTextDocument: onDidChangeTextDocument.event,
    onDidCloseTextDocument: onDidCloseTextDocument.event,
    onDidSaveTextDocument: onDidSaveTextDocument.event,
    onDidRenameFiles: onDidRenameFiles.event,
    onDidDeleteFiles: onDidDeleteFiles.event,
    registerTextDocumentContentProvider: () => emptyDisposable,
    asRelativePath: (pathOrUri: string | vscode.Uri, includeWorkspaceFolder?: boolean): string => pathOrUri.toString(),
    createFileSystemWatcher: () => emptyFileWatcher,
    getConfiguration: (() => configuration) as any,
    fs: {
        stat: async uri => {
            const stat = await fspromises.stat(uri.fsPath)
            const type = stat.isFile()
                ? FileType.File
                : stat.isDirectory()
                ? FileType.Directory
                : stat.isSymbolicLink()
                ? FileType.SymbolicLink
                : FileType.Unknown

            return {
                type,
                ctime: stat.ctimeMs,
                mtime: stat.mtimeMs,
                size: stat.size,
            }
        },
        readDirectory: async uri => {
            const entries = await fspromises.readdir(uri.fsPath, { withFileTypes: true })

            return entries.map(entry => {
                const type = entry.isFile()
                    ? FileType.File
                    : entry.isDirectory()
                    ? FileType.Directory
                    : entry.isSymbolicLink()
                    ? FileType.SymbolicLink
                    : FileType.Unknown

                return [entry.name, type]
            })
        },
        createDirectory: async uri => {
            await fspromises.mkdir(uri.fsPath, { recursive: true })
        },
        readFile: async uri => {
            const content = await fspromises.readFile(uri.fsPath)
            return new Uint8Array(content.buffer)
        },
        writeFile: async (uri, content) => {
            await fspromises.writeFile(uri.fsPath, content)
        },
        delete: async (uri, options) => {
            const provider = this.throwIfFileSystemIsReadonly(await this.withProvider(resource), resource)
            if (useTrash && !(provider.capabilities & FileSystemProviderCapabilities.Trash)) {
                throw new Error(
                    localize(
                        'deleteFailedTrashUnsupported',
                        "Unable to delete file '{0}' via trash because provider does not support it.",
                        this.resourceForError(resource)
                    )
                )
            }
            if (options?.useTrash) {
                throw new Error('Trash is not supported by the agent')
            }
            await fspromises.rm(uri.fsPath, { recursive: options?.recursive })
        },
        rename: async (source, target, options) => {
            if (!options?.overwrite && fs.existsSync(target.fsPath)) {
                throw new Error('Target path already exists and overwrite is set to false.')
            }
            await fspromises.rename(source.fsPath, target.fsPath)
        },
        copy: async (source, target, options) => {
            const mode = options?.overwrite ? 0 : fspromises.constants.COPYFILE_EXCL
            await fspromises.copyFile(source.fsPath, target.fsPath, mode)
        },
        isWritableFileSystem: scheme => {
            return scheme === 'file' || scheme === 'git'
        },
    },
}
export const workspace = _workspace as typeof vscode.workspace

const statusBarItem: Partial<vscode.StatusBarItem> = {
    show: () => {},
}

export const visibleTextEditors: vscode.TextEditor[] = []

export const tabGroups = new AgentTabGroups()
let agent: Agent | undefined
export function setAgent(newAgent: Agent): void {
    agent = newAgent
}

const _window: Partial<typeof vscode.window> = {
    tabGroups,
    registerCustomEditorProvider: () => emptyDisposable,
    registerFileDecorationProvider: () => emptyDisposable,
    registerTerminalLinkProvider: () => emptyDisposable,
    registerTerminalProfileProvider: () => emptyDisposable,
    registerTreeDataProvider: () => emptyDisposable,
    registerWebviewPanelSerializer: () => emptyDisposable,
    onDidChangeTextEditorVisibleRanges: emptyEvent(),
    onDidChangeActiveColorTheme: emptyEvent(),
    onDidChangeActiveNotebookEditor: emptyEvent(),
    onDidChangeActiveTerminal: emptyEvent(),
    onDidChangeNotebookEditorSelection: emptyEvent(),
    onDidChangeNotebookEditorVisibleRanges: emptyEvent(),
    onDidChangeTerminalState: emptyEvent(),
    onDidChangeTextEditorOptions: emptyEvent(),
    onDidChangeTextEditorViewColumn: emptyEvent(),
    onDidChangeVisibleNotebookEditors: emptyEvent(),
    onDidChangeWindowState: emptyEvent(),
    onDidCloseTerminal: emptyEvent(),
    onDidOpenTerminal: emptyEvent(),
    registerUriHandler: () => emptyDisposable,
    registerWebviewViewProvider: () => emptyDisposable,
    createStatusBarItem: (() => statusBarItem) as any,
    visibleTextEditors,
    withProgress: (_, handler) => handler({ report: () => {} }, 'window.withProgress.cancelationToken' as any),
    onDidChangeActiveTextEditor: onDidChangeActiveTextEditor.event,
    onDidChangeVisibleTextEditors: (() => ({})) as any,
    onDidChangeTextEditorSelection: (() => ({})) as any,
    showErrorMessage: (message: string, ...items: any[]) => {
        if (agent) {
            agent.notify('debug/message', { channel: 'window.showErrorMessage', message })
        }
        return Promise.resolve(undefined)
    },
    showWarningMessage: (message: string, ...items: any[]) => {
        if (agent) {
            agent.notify('debug/message', { channel: 'window.showWarningMessage', message })
        }
        return Promise.resolve(undefined)
    },
    showInformationMessage: (message: string, ...items: any[]) => {
        if (agent) {
            agent.notify('debug/message', { channel: 'window.showInformationMessage', message })
        }
        return Promise.resolve(undefined)
    },
    createOutputChannel: ((name: string) =>
        ({
            name,
            append: message => {
                if (agent) {
                    agent.notify('debug/message', { channel: name, message })
                }
            },
            appendLine: message => {
                if (agent) {
                    agent.notify('debug/message', { channel: name, message })
                }
            },
            replace: message => {
                if (agent) {
                    agent.notify('debug/message', { channel: name, message })
                }
            },
            clear: () => {},
            show: () => {},
            hide: () => {},
            dispose: () => {},
        }) as vscode.OutputChannel) as any,
    createTextEditorDecorationType: () => ({ key: 'foo', dispose: () => {} }),
}

export const window = _window as typeof vscode.window

const _extensions: Partial<typeof vscode.extensions> = {
    getExtension: (extensionId: string) => undefined,
}
export const extensions = _extensions as typeof vscode.extensions

interface RegisteredCommand {
    command: string
    callback: (...args: any[]) => any
    thisArg?: any
}
const registeredCommands = new Map<string, RegisteredCommand>()

const _commands: Partial<typeof vscode.commands> = {
    registerCommand: (command: string, callback: (...args: any[]) => any, thisArg?: any) => {
        const value: RegisteredCommand = { command, callback, thisArg }
        registeredCommands.set(command, value)
        return new Disposable(() => {
            const registered = registeredCommands.get(command)
            if (registered === value) {
                registeredCommands.delete(command)
            }
        })
    },
    executeCommand: (command, args) => {
        const registered = registeredCommands.get(command)
        if (registered) {
            try {
                if (args) {
                    return promisify(registered.callback(...args))
                }
                return promisify(registered.callback())
            } catch (error) {
                console.error(error)
            }
        }

        return Promise.resolve(undefined)
    },
}

function promisify(value: any): Promise<any> {
    return value instanceof Promise ? value : Promise.resolve(value)
}

export const commands = _commands as typeof vscode.commands

const _env: Partial<typeof vscode.env> = {
    uriScheme: 'file',
    appRoot: process.cwd(),
    uiKind: UIKind.Web,
    language: process.env.language,
    clipboard: {
        readText: () => Promise.resolve(''),
        writeText: () => Promise.resolve(),
    },
}
export const env = _env as typeof vscode.env

let latestCompletionProvider: InlineCompletionItemProvider | undefined
let resolveFirstCompletionProvider: (provider: InlineCompletionItemProvider) => void = () => {}
const firstCompletionProvider = new Promise<InlineCompletionItemProvider>(resolve => {
    resolveFirstCompletionProvider = resolve
})
export function completionProvider(): Promise<InlineCompletionItemProvider> {
    if (latestCompletionProvider) {
        return Promise.resolve(latestCompletionProvider)
    }
    return firstCompletionProvider
}

const _languages: Partial<typeof vscode.languages> = {
    getLanguages: () => Promise.resolve([]),
    registerCodeActionsProvider: () => emptyDisposable,
    registerCodeLensProvider: () => emptyDisposable,
    registerInlineCompletionItemProvider: (_selector, provider) => {
        latestCompletionProvider = provider as any
        resolveFirstCompletionProvider(provider as any)
        return emptyDisposable
    },
}
export const languages = _languages as typeof vscode.languages

const commentController: vscode.CommentController = {
    createCommentThread(uri, range, comments) {
        return 'createCommentThread' as any
    },
    id: 'commentController.id',
    label: 'commentController.label',
    dispose: () => {},
}
const _comments: Partial<typeof vscode.comments> = {
    createCommentController: () => commentController,
}
export const comments = _comments as typeof vscode.comments
