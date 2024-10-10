import type { Observable } from 'observable-fns'
import { useEffect, useRef, useState } from 'react'

export type UseObservableResult<T> = {
    /**
     * The last value from the Observable, or `undefined` if no value has been emitted yet.
     *
     * It is not possible in this API to differentiate "no value emitted yet" from "value
     * `undefined` emitted".
     */
    value: T | undefined
} & (
    | {
          done: false
          error: null
      }
    | {
          done: true
          error: Error | null
      }
)

const INITIAL: UseObservableResult<any> = {
    value: undefined,
    done: false,
    error: null,
}

const pigs: { [key: string]: number } = {}

/**
 * React hook to return the latest value and complete/error state from an Observable.
 *
 * The Observable ({@link observable} arg) should be wrapped in `useMemo`.
 */
export function useObservable<T>(
    observable: Observable<T>,
    options?: {
        /**
         * By default, the prior result value will be reused even if `factory` changes, until the
         * next value is emitted. If `preserveValueKey` is set, then the prior result value will be
         * discarded if the current `preserveValueKey` value differs from the previous one.
         */
        preserveValueKey?: string | number
    }
): UseObservableResult<T> {
    const [state, setState] = useState<UseObservableResult<T>>(INITIAL)

    const lastPreserveValueKey = useRef(options?.preserveValueKey ?? undefined)

    useEffect(() => {
        const here = new Error().stack || '???'
        pigs[here] = (pigs[here] ?? 0) + 1
        const [sum, max, maxCount] = Object.entries(pigs).reduce(
            ([sum, max, maxCount], [name, count]) => {
                return [sum + count, count > maxCount ? name : max, Math.max(count, maxCount)]
            },
            [0, 'none', 0]
        )
        console.log('useObservable pigs:', sum, maxCount / sum, max)

        let isMounted = true

        if (lastPreserveValueKey.current !== options?.preserveValueKey) {
            setState(INITIAL)
            lastPreserveValueKey.current = options?.preserveValueKey
        }

        const subscription = observable.subscribe({
            next: value => {
                if (isMounted) {
                    setState({ value, done: false, error: null })
                }
            },
            error: error => {
                if (isMounted) {
                    setState(prevState => ({ ...prevState, done: true, error: error as Error }))
                }
            },
            complete: () => {
                if (isMounted) {
                    setState(prevState => ({ ...prevState, done: true }))
                }
            },
        })

        return () => {
            pigs[here] = (pigs[here] ?? 1) - 1
            isMounted = false
            subscription.unsubscribe()
        }
    }, [observable, options?.preserveValueKey])

    return state
}

export function waitForObservableInTest(): Promise<void> {
    return new Promise(resolve => {
        setTimeout(resolve)
    })
}
