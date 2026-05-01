import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, ExternalLink } from 'lucide-react';
import { apiClient, ListingDocument } from '@/integrations/api/client';

interface DocumentsListProps {
  listingId: string;
}

const DOCUMENT_KIND_LABELS: Record<string, string> = {
  energimaerke: 'Energimærke',
  tilstandsrapport: 'Tilstandsrapport',
  elinstallationsrapport: 'Elinstallationsrapport',
  ejerudgift: 'Ejerudgifter',
  servitut: 'Servitutter',
  bbr: 'BBR-meddelelse',
  tingbog: 'Tingbogsattest',
  forsikring: 'Forsikringsoplysninger',
  vedtaegter: 'Vedtægter',
  husorden: 'Husorden',
  referat: 'Referat',
  regnskab: 'Regnskab',
  budget: 'Budget',
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const labelForDocument = (doc: ListingDocument): string => {
  if (doc.kind && DOCUMENT_KIND_LABELS[doc.kind]) {
    return DOCUMENT_KIND_LABELS[doc.kind];
  }
  return doc.filename;
};

const DocumentsList: React.FC<DocumentsListProps> = ({ listingId }) => {
  const { data: documents } = useQuery({
    queryKey: ['listing-documents', listingId],
    queryFn: () => apiClient.getDocuments(listingId),
    enabled: Boolean(listingId),
  });

  if (!documents || documents.length === 0) {
    return null;
  }

  return (
    <div className="bg-card text-card-foreground rounded-xl p-6 mb-8">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <FileText className="h-5 w-5 text-purple" />
        Dokumenter fra mægler
      </h2>
      <ul className="space-y-2">
        {documents.map((doc) => (
          <li key={doc.id}>
            <a
              href={apiClient.documentDownloadUrl(listingId, doc.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 transition-colors hover:bg-muted/60"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">
                  {labelForDocument(doc)}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {doc.filename} · {formatBytes(doc.size_bytes)}
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DocumentsList;
