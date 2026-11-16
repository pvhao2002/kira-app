export interface KnowledgeSource { title: string; number?: string; issuer?: string; effectiveDate?: string; url?: string }

export interface KnowledgeEntry { id: string; category: string; title: string; kind: 'legal' | 'policy' | 'recommendation'; body: string[]; bullets?: string[]; sources: KnowledgeSource[]; verified: boolean; updatedAt: string }
