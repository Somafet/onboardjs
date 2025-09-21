import { ConditionRule, ConditionGroup } from '../types'

export class ParseCache {
    private _cache = new Map<string, ConditionRule | ConditionGroup>()

    get(key: string): ConditionRule | ConditionGroup | undefined {
        return this._cache.get(key)
    }

    set(key: string, value: ConditionRule | ConditionGroup): void {
        this._cache.set(key, value)
    }

    has(key: string): boolean {
        return this._cache.has(key)
    }

    clear(): void {
        this._cache.clear()
    }

    createKey(node: any): string {
        return JSON.stringify({
            type: node.type,
            operator: node.operator,
            name: node.name,
            value: node.value,
        })
    }
}

// Global cache instance
export const parseCache = new ParseCache()
