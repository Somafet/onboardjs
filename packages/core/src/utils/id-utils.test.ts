import { describe, it, expect } from 'vitest'
import { generateSecureId } from './id-utils'

describe('id-utils', () => {
    describe('generateSecureId', () => {
        it('should generate unique IDs across multiple calls', () => {
            const ids = new Set<string>()
            const iterations = 100

            for (let i = 0; i < iterations; i++) {
                ids.add(generateSecureId())
            }

            expect(ids.size).toBe(iterations)
        })

        it('should generate IDs with the correct prefix', () => {
            const id = generateSecureId()
            expect(id).toMatch(/^session_/)
        })

        it('should generate IDs with the correct format (session_ followed by 32 hex characters)', () => {
            const id = generateSecureId()
            // session_ prefix + 32 hex characters (16 bytes * 2 hex chars per byte)
            expect(id).toMatch(/^session_[0-9a-f]{32}$/)
        })

        it('should generate IDs with consistent length', () => {
            const id1 = generateSecureId()
            const id2 = generateSecureId()
            const id3 = generateSecureId()

            // 'session_' (8 chars) + 32 hex chars = 40 chars total
            const expectedLength = 40

            expect(id1.length).toBe(expectedLength)
            expect(id2.length).toBe(expectedLength)
            expect(id3.length).toBe(expectedLength)
        })

        it('should return a string type', () => {
            const id = generateSecureId()
            expect(typeof id).toBe('string')
        })

        it('should contain only valid hexadecimal characters after prefix', () => {
            const id = generateSecureId()
            const hexPart = id.replace('session_', '')

            // Check that all characters are valid hex (0-9, a-f)
            expect(hexPart).toMatch(/^[0-9a-f]+$/)
        })

        it('should generate different IDs on consecutive calls', () => {
            const id1 = generateSecureId()
            const id2 = generateSecureId()

            expect(id1).not.toBe(id2)
        })

        it('should generate IDs that start with lowercase hex characters', () => {
            const id = generateSecureId()
            const hexPart = id.replace('session_', '')

            // Verify lowercase (no uppercase A-F)
            expect(hexPart).not.toMatch(/[A-F]/)
        })
    })
})
