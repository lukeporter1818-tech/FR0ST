// Prisma v7 does not generate an index.ts in the output directory.
// This script recreates it so that `@/generated/prisma` can be resolved
// by Next.js / Turbopack after `prisma generate` runs.
const fs = require('fs')
const path = require('path')

const out = path.join(__dirname, '..', 'src', 'generated', 'prisma', 'index.ts')
const content = `export * from './client'
export * from './models'
export * from './enums'
export * from './commonInputTypes'
`
fs.writeFileSync(out, content)
console.log('✓ Recreated src/generated/prisma/index.ts')
