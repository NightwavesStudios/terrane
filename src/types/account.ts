import type { RecordState } from "./record";

/** The user-owned part of a record. Profile identity belongs to the account. */
export type RecordData = Omit<RecordState, "profile">;

export interface AccountSession {
  profile: RecordState["profile"];
  record: RecordState;
  revision: number;
}
