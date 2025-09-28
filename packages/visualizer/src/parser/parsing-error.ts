export default class ParsingError extends Error {
    constructor(
        message: string,
        public error?: unknown
    ) {
        super(message)
        this.name = 'ParsingError'
    }
}
