import { logger } from "./logger";

const elasticsearchUrl = process.env.ELASTICSEARCH_URL?.trim();
const elasticsearchApiKey = process.env.ELASTICSEARCH_API_KEY?.trim();

export const logsIndexName =
  process.env.ELASTICSEARCH_LOGS_INDEX?.trim() || "observatory-logs";

let elasticsearchClient: any = null;

if (elasticsearchUrl) {
  try {
    const { Client } = require("@elastic/elasticsearch");
    elasticsearchClient = new Client({
      node: elasticsearchUrl,
      auth: elasticsearchApiKey ? { apiKey: elasticsearchApiKey } : undefined,
    });
  } catch (error) {
    logger.warn({ err: error }, "Elasticsearch client not available");
    elasticsearchClient = null;
  }
}

export type IndexedLogDocument = {
  id: string;
  timestamp: string;
  level: string;
  service: string;
  message: string;
  environment: string;
  traceId?: string;
  spanId?: string;
  metadata?: unknown;
};

type SearchLogDocumentsParams = {
  level?: string;
  service?: string;
  search?: string;
  limit: number;
  offset: number;
};

type SearchLogDocumentsResult = {
  logs: IndexedLogDocument[];
  total: number;
};

export function isElasticsearchEnabled() {
  return elasticsearchClient !== null;
}

export async function indexLogDocument(document: IndexedLogDocument) {
  if (!elasticsearchClient) {
    return;
  }

  try {
    await elasticsearchClient.index({
      index: logsIndexName,
      id: document.id,
      document,
    });
  } catch (error) {
    logger.warn(
      {
        err: error,
        index: logsIndexName,
        service: document.service,
        logId: document.id,
      },
      "Failed to index log document in Elasticsearch",
    );
  }
}

export async function indexLogDocuments(documents: IndexedLogDocument[]) {
  if (!elasticsearchClient || documents.length === 0) {
    return;
  }

  try {
    await elasticsearchClient.bulk({
      refresh: false,
      operations: documents.flatMap((document) => [
        {
          index: {
            _index: logsIndexName,
            _id: document.id,
          },
        },
        document,
      ]),
    });
  } catch (error) {
    logger.warn(
      {
        err: error,
        index: logsIndexName,
        count: documents.length,
      },
      "Failed to bulk index log documents in Elasticsearch",
    );
  }
}

export async function searchLogDocuments({
  level,
  service,
  search,
  limit,
  offset,
}: SearchLogDocumentsParams): Promise<SearchLogDocumentsResult | null> {
  if (!elasticsearchClient) {
    return null;
  }

  try {
    const filters = [
      level ? { term: { "level.keyword": level } } : null,
      service ? { term: { "service.keyword": service } } : null,
    ].filter((f): f is NonNullable<typeof f> => f != null);

    const query = search
      ? {
          bool: {
            should: [
              { multi_match: { query: search, fields: ["message", "service", "environment"] } },
              { term: { "id.keyword": search } },
            ],
            minimum_should_match: 1,
            filter: filters,
          },
        }
      : filters.length > 0
        ? { bool: { filter: filters } }
        : { match_all: {} };

    const result = await elasticsearchClient.search<IndexedLogDocument>({
      index: logsIndexName,
      from: offset,
      size: limit,
      sort: [{ timestamp: { order: "desc" } }],
      query,
    });

    const total =
      typeof result.hits.total === "number"
        ? result.hits.total
        : (result.hits.total?.value ?? 0);

    return {
      logs: result.hits.hits
        .map((hit) => hit._source)
        .filter((document): document is IndexedLogDocument => document != null),
      total,
    };
  } catch (error) {
    logger.warn(
      {
        err: error,
        index: logsIndexName,
        level,
        service,
        search,
        limit,
        offset,
      },
      "Failed to query logs from Elasticsearch",
    );

    return null;
  }
}
