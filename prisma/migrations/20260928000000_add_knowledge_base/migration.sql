-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- KnowledgeDoc: one row per uploaded source document (e.g. a PDF manual)
CREATE TABLE "KnowledgeDoc" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "pageCount" INTEGER,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDoc_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KnowledgeDoc_sha256_key" ON "KnowledgeDoc"("sha256");
CREATE INDEX "KnowledgeDoc_uploadedById_idx" ON "KnowledgeDoc"("uploadedById");

ALTER TABLE "KnowledgeDoc"
    ADD CONSTRAINT "KnowledgeDoc_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- KnowledgeChunk: one row per embedded chunk of a KnowledgeDoc
CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "page" INTEGER,
    "text" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "embedding" vector(1024) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KnowledgeChunk_docId_ordinal_key" ON "KnowledgeChunk"("docId", "ordinal");
CREATE INDEX "KnowledgeChunk_docId_idx" ON "KnowledgeChunk"("docId");

CREATE INDEX "KnowledgeChunk_embedding_hnsw_idx"
    ON "KnowledgeChunk"
    USING hnsw ("embedding" vector_cosine_ops);

ALTER TABLE "KnowledgeChunk"
    ADD CONSTRAINT "KnowledgeChunk_docId_fkey"
    FOREIGN KEY ("docId") REFERENCES "KnowledgeDoc"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
