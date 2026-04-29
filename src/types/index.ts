// Type definitions matching turntf HTTP API JSON responses (snake_case).

export interface UserRef {
  node_id: number;
  user_id: number;
}

export interface Message {
  recipient: UserRef;
  node_id: number;
  seq: number;
  sender: UserRef;
  body: number[]; // JSON array of bytes
  created_at: string;
}

export interface User {
  node_id: number;
  user_id: number;
  username: string;
  role: string;
  profile: unknown;
  system_reserved: boolean;
  created_at: string;
  updated_at: string;
  origin_node_id: number;
}

export interface Event {
  sequence: number;
  event_id: number;
  event_type: string;
  aggregate: string;
  aggregate_node_id: number;
  aggregate_id: number;
  hlc: string;
  origin_node_id: number;
  event: unknown;
}

export interface Attachment {
  owner: UserRef;
  subject: UserRef;
  attachment_type: string;
  config_json: number[];
  attached_at: string;
  deleted_at: string;
  origin_node_id: number;
}

export const AttachmentType = {
  ChannelManager: "channel_manager",
  ChannelWriter: "channel_writer",
  ChannelSubscription: "channel_subscription",
  UserBlacklist: "user_blacklist",
} as const;

export interface OperationsStatus {
  node_id: number;
  message_window_size: number;
  last_event_sequence: number;
  write_gate_ready: boolean;
  conflict_total: number;
  message_trim: { trimmed_total: number };
  event_log_trim: Record<string, unknown>;
  projection: Record<string, unknown>;
  peers: Array<{
    peer_node_id: number;
    status: string;
    configured_url: string;
    source: string;
  }>;
}
