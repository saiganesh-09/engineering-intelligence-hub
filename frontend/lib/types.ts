// Types mirroring the backend schemas.

export type Role = "admin" | "manager" | "developer";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  auth_provider: string;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export type DocumentStatus = "pending" | "processing" | "indexed" | "failed";
export type SourceType = "document" | "code" | "incident" | "runbook" | "architecture" | "faq";
export type IndexingStatus = "pending" | "indexing" | "completed" | "failed";
export type IncidentSeverity = "critical" | "high" | "medium" | "low";
export type IncidentStatus = "open" | "investigating" | "resolved" | "closed";

export interface Document {
  id: string;
  title: string;
  file_name: string;
  file_type: string;
  source_type: SourceType;
  file_size: number;
  status: DocumentStatus;
  error: string | null;
  project_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Chunk {
  id: string;
  source_type: SourceType;
  content: string;
  token_count: number;
  meta: Record<string, unknown>;
  document_id: string | null;
  code_file_id: string | null;
  incident_id: string | null;
  score?: number | null;
}

export interface Repository {
  id: string;
  name: string;
  owner: string;
  url: string;
  branch: string;
  indexing_status: IndexingStatus;
  last_indexed_at: string | null;
  error: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  file_count: number;
}

export interface CodeFile {
  id: string;
  repository_id: string;
  file_path: string;
  language: string | null;
  size: number;
  meta: Record<string, unknown>;
}

export interface CodeFileContent extends CodeFile {
  content: string;
}

export interface RepoTreeNode {
  name: string;
  path: string;
  type: "dir" | "file";
  language?: string | null;
  children: RepoTreeNode[];
}

export interface Incident {
  id: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  description: string;
  root_cause: string | null;
  resolution: string | null;
  preventive_actions: string | null;
  timeline: string | null;
  affected_services: string[];
  occurred_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RetrievedSource {
  chunk_id: string;
  source_type: SourceType;
  source_id: string | null;
  title: string;
  path: string | null;
  repository: string | null;
  snippet: string;
  score: number;
}

export interface Citation {
  id: string;
  source_type: SourceType;
  source_id: string | null;
  chunk_id: string | null;
  title: string;
  meta: {
    path?: string;
    repository?: string;
    snippet?: string;
    score?: number;
    cited?: boolean;
    url?: string;
    section?: string;
    page_start?: number;
    language?: string;
    [k: string]: unknown;
  };
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  citations: Citation[];
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ConversationDetail extends Conversation {
  messages: Message[];
}

export interface ChatResponse {
  conversation_id: string;
  message_id: string;
  answer: string;
  sources: RetrievedSource[];
  insufficient_context: boolean;
}

export interface SearchResult {
  chunk_id: string;
  source_type: SourceType;
  title: string;
  snippet: string;
  score: number;
  document_id: string | null;
  repository: string | null;
  file_path: string | null;
  language: string | null;
  incident_id: string | null;
  updated_at: string | null;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
}

export interface DashboardStats {
  documents: number;
  repositories: number;
  incidents: number;
  open_incidents: number;
  conversations: number;
  questions: number;
  users: number;
  chunks: number;
  failed_indexing: number;
}

export interface ActivityItem {
  kind: "document" | "incident" | "conversation" | "repository";
  title: string;
  timestamp: string;
  status: string | null;
  id: string | null;
}

export interface PopularQuestion {
  question: string;
  count: number;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  repository_url: string | null;
  created_at: string;
}

export interface AIResult {
  answer: string;
  sources: RetrievedSource[];
}

export interface IncidentStats {
  total: number;
  open: number;
  by_severity: Record<string, number>;
  most_affected_services: { service: string; count: number }[];
}
