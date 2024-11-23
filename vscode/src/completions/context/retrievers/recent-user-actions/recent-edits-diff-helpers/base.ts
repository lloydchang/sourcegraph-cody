import type { PromptString } from '@sourcegraph/cody-shared'
import type * as vscode from 'vscode'

export interface RecentEditsRetrieverDiffStrategy {
    getDiffHunks(input: DiffCalculationInput): DiffHunk[]
    getDiffStrategyName(): string
}

export interface TextDocumentChange {
    timestamp: number
    change: vscode.TextDocumentContentChangeEvent
    // The range in the document where the text was inserted.
    insertedRange: vscode.Range
}

export interface DiffCalculationInput {
    uri: vscode.Uri
    oldContent: string
    changes: TextDocumentChange[]
}

export interface DiffHunk {
    uri: vscode.Uri
    latestEditTimestamp: number
    diff: PromptString
}

export interface UnifiedPatchResponse {
    uri: vscode.Uri
    newContent: string
    diff: PromptString
    latestEditTimestamp: number
}