import * as fs from 'fs'
import * as ts from 'typescript'

describe('Types (e2e)', () => {
  let fileContent: string

  beforeAll(() => {
    fileContent = fs.readFileSync(
      `${process.cwd()}/e2e/manifest/.manifest/types.ts`,
      'utf8'
    )
  })

  it('should generate a valid TypeScript types.ts file', async () => {
    // Use TypeScript's compiler API to parse the file content and check for syntax errors.
    const sourceFile = ts.createSourceFile(
      'test.ts',
      fileContent,
      ts.ScriptTarget.Latest,
      true
    )

    const diagnostics = []
    function visitNode(node) {
      if (node.kind === ts.SyntaxKind.Unknown) {
        diagnostics.push(`Syntax error at position ${node.pos}`)
      }
      ts.forEachChild(node, visitNode)
    }

    visitNode(sourceFile)
    expect(diagnostics).toHaveLength(0)
  })

  it('should include entity types', async () => {
    expect(fileContent).toContain('export interface User {')
    expect(fileContent).toContain('export interface Bird {')
    expect(fileContent).toContain('export interface Cat {')
    expect(fileContent).toContain('export interface Snake {')
  })

  it('should include entity DTO types', async () => {
    expect(fileContent).toContain('export interface CreateUpdateUserDto {')
    expect(fileContent).toContain('export interface CreateUpdateBirdDto {')
    expect(fileContent).toContain('export interface CreateUpdateCatDto {')
    expect(fileContent).toContain('export interface CreateUpdateSnakeDto {')
  })

  it('should generate nested entity types', async () => {
    expect(fileContent).toContain('export interface Step {')
  })

  it('should include nested types in entities and DTOs', async () => {
    expect(fileContent).toContain('steps?: Step[];')
  })

  it('should not generate DTOs for nested entities', async () => {
    expect(fileContent).not.toContain('export interface CreateUpdateStepDto {')
  })
})
