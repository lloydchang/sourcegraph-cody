import { exec, execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import * as commander from 'commander'
import * as vscode from 'vscode'
import type { RpcMessageHandler } from '../../../vscode/src/jsonrpc/jsonrpc'
import { newAgentClient } from '../agent'
import { type EditorEvent, applyEventForRPCClient } from '../cody-nes-events'
import {AutocompleteContextSnippet} from '@sourcegraph/cody-shared';
// import {AutocompleteResult} from '../../../vscode/src/jsonrpc/agent-protocol';

// pnpm agent internal autocomplete-context-bench \
//   --config-path /Users/hiteshsagtani/Desktop/completion-eval-dataset.json \
//   --temp-repo-path /Users/hiteshsagtani/tmp-repos-bench

interface Event {
    timestamp: number
    eventName: string
    filePath: string
    language: string
    data: string
}

interface ContextDatapoint {
    repoURL: string
    commit: string
    filePath: string
    line: number
    column: number
    groundTruth: string
    events: Event[]
}

interface AutocompleteContextBenchOptions {
    srcAccessToken: string
    srcEndpoint: string
    configPath: string
    tempRepoPath: string
    outputPath: string
}

interface AutocompleteContextResult extends ContextDatapoint {
    preRankingContextCandidates?: AutocompleteContextSnippet[]
    postRankingContextCandidates?: AutocompleteContextSnippet[]
    providerModel?: string
    resolvedModel?: string
    prefix?: string
    suffix?: string
}

async function evaluateCompletions(
    option: AutocompleteContextBenchOptions,
    datapoint: ContextDatapoint
): Promise<AutocompleteContextResult> {
    const { owner, name } = getRepoOwnerAndName(datapoint.repoURL)
    const repoClonePath = path.join(option.tempRepoPath, owner, name)
    // todo: Use git work tree instead
    cloneRepoIfNotExists(datapoint.repoURL, repoClonePath)
    checkoutRepoToCommit(repoClonePath, datapoint.commit)
    const client = await initializeClientForWorkSpace(option, repoClonePath)
    await applyEventToWorkspace(client, datapoint.events, repoClonePath)
    const documentPath = path.join(repoClonePath, datapoint.filePath)

    const autocompleteResult = await client.request('autocomplete/execute', {
        uri: documentPath,
        filePath: documentPath,
        position: new vscode.Position(datapoint.line, datapoint.column),
        triggerKind: 'Invoke',
    })
    const result: AutocompleteContextResult = {
        ...datapoint,
        preRankingContextCandidates: autocompleteResult.contextResults?.retrievalSummary.contextCandidatesPreRanking,
        postRankingContextCandidates: autocompleteResult.contextResults?.retrievalSummary.contextCandidatesPostRanking,
        providerModel: autocompleteResult.completionEvent?.params.providerModel,
        resolvedModel: autocompleteResult.completionEvent?.params.resolvedModel,
        prefix: autocompleteResult.completionEvent?.params.inlineCompletionItemContext?.prefix,
        suffix: autocompleteResult.completionEvent?.params.inlineCompletionItemContext?.suffix,
    }
    return result
}

async function applyEventToWorkspace(client: RpcMessageHandler, events: Event[], repoClonePath: string) {
    for (const event of events) {
        const { timestamp, eventName, filePath, language, data } = event
        const editorEvent: EditorEvent = {
            timestamp: timestamp.toString(),
            eventType: eventName as EditorEvent['eventType'],
            uri: path.join(repoClonePath, filePath),
            languageId: language,
            json: data,
        }
        await applyEventForRPCClient(client, editorEvent)
    }
}

export const autocompleteContextBench = new commander.Command('autocomplete-context-bench')
    .addOption(
        new commander.Option(
            '--src-access-token <token>',
            'The Sourcegraph access token to use for authentication'
        ).env('SRC_ACCESS_TOKEN')
    )
    .addOption(
        new commander.Option(
            '--src-endpoint <url>',
            'The Sourcegraph URL endpoint to use for authentication'
        ).env('SRC_ENDPOINT')
    )
    .option('--temp-repo-path <path>', 'Temporary Path to save the cloned repos to')
    .option('--config-path <path>', 'Path to a JSON with configuration to compute TSC context')
    .option('--output-path <path>', 'Path to a Save the results')
    .action(async (option: AutocompleteContextBenchOptions) => {
        const configBuffer = await fs.promises.readFile(option.configPath)
        const dataPoints = JSON.parse(configBuffer.toString()) as ContextDatapoint[]

        const results: AutocompleteContextResult[] = []
        for (const datapoint of dataPoints) {
            results.push(await evaluateCompletions(option, datapoint))
        }
        await fs.promises.writeFile(option.outputPath, JSON.stringify(results, null, 2))
        process.exit(0)
    })

// ------- ******* ------- ******* ------- ******* ------- ******* ------- ******* ------- ******* -------

async function initializeClientForWorkSpace(
    option: AutocompleteContextBenchOptions,
    localRepoPath: string
): Promise<RpcMessageHandler> {
    const workspaceRootUri = vscode.Uri.from({ scheme: 'file', path: localRepoPath })
    const { client } = await newAgentClient({
        name: 'autocomplete-context-bench',
        version: '0.1.0',
        workspaceRootUri: workspaceRootUri.toString(),
        extensionConfiguration: {
            accessToken: option.srcAccessToken,
            serverEndpoint: option.srcEndpoint,
            customHeaders: {},
            customConfiguration: {
                'cody.experimental.telemetry.enabled': false,
                'cody.telemetry.level': 'off',
            },
        },
        inheritStderr: true,
    })
    return client
}

function cloneRepoIfNotExists(repoURL: string, localRepoPath: string) {
    try {
        fs.accessSync(localRepoPath)
        console.log(`Repository ${repoURL} already exists in ${localRepoPath}`)
    } catch {
        try {
            execSync(`git clone ${repoURL} ${localRepoPath}`)
            console.log(`Cloned repository ${repoURL} to ${localRepoPath}`)
        } catch (error) {
            console.error(`Failed to clone repository: ${error}`)
            throw new Error(`Failed to clone repository: ${error}`)
        }
    }
}

function checkoutRepoToCommit(localRepoPath: string, commit: string) {
    try {
        exec(`git -C ${localRepoPath} checkout ${commit}`, error => {
            if (error) {
                throw error
            }
        })
    } catch (error) {
        console.error(`Failed to checkout repository to commit: ${error}`)
        throw new Error(`Failed to checkout repository to commit: ${error}`)
    }
}

function getRepoOwnerAndName(repoURL: string) {
    const url = new URL(repoURL)
    const pathParts = url.pathname.split('/')
    const owner = pathParts[1]
    const name = pathParts[2]
    return { owner, name }
}

// ------- ******* ------- ******* ------- ******* ------- ******* ------- ******* ------- ******* -------
