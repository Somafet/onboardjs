export function generateSecureId(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    return `session_${Array.from<number>(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')}`
}
