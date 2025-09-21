import type { Node } from 'acorn'
import { ConditionRule, ConditionGroup } from '../types'

export interface ASTVisitor {
    visit(node: Node): ConditionRule | ConditionGroup
    visitBinaryExpression(node: any): ConditionRule
    visitLogicalExpression(node: any): ConditionGroup
    visitMemberExpression(node: any): ConditionRule
    visitConditionalExpression(node: any): ConditionRule | ConditionGroup
    visitIfStatement(node: any): ConditionRule | ConditionGroup
    visitIdentifier(node: any): ConditionRule
    visitLiteral(node: any): ConditionRule
}

export abstract class BaseASTVisitor implements ASTVisitor {
    abstract visit(node: Node): ConditionRule | ConditionGroup
    abstract visitBinaryExpression(node: any): ConditionRule
    abstract visitLogicalExpression(node: any): ConditionGroup
    abstract visitMemberExpression(node: any): ConditionRule
    abstract visitConditionalExpression(node: any): ConditionRule | ConditionGroup
    abstract visitIfStatement(node: any): ConditionRule | ConditionGroup
    abstract visitIdentifier(node: any): ConditionRule
    abstract visitLiteral(node: any): ConditionRule

    protected getEmptyGroup(): ConditionGroup {
        return {
            id: this.generateId(),
            logic: 'AND',
            rules: [],
        }
    }

    protected abstract generateId(): string
}
