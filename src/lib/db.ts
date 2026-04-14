import { env } from "@/lib/env";
import * as sqliteDb from "@/lib/db-sqlite";
import * as postgresDb from "@/lib/db-postgres";
import type {
  CommandToggleRecord,
  GuildConfigRecord,
  ReactionRolePanelRecord,
  RaidGateRecord,
  TotpRecord,
  WarningRecord
} from "@/lib/types";

const usePostgres = env.dashboardDbDriver === "postgres";

export const KNOWN_TOGGLEABLE_COMMANDS: string[] = usePostgres
  ? postgresDb.KNOWN_TOGGLEABLE_COMMANDS
  : sqliteDb.KNOWN_TOGGLEABLE_COMMANDS;

export async function listKnownGuildIds(limit = 1000): Promise<string[]> {
  return usePostgres
    ? postgresDb.listKnownGuildIds(limit)
    : Promise.resolve(sqliteDb.listKnownGuildIds(limit));
}

export async function getGuildConfig(guildId: string): Promise<GuildConfigRecord> {
  return usePostgres
    ? postgresDb.getGuildConfig(guildId)
    : Promise.resolve(sqliteDb.getGuildConfig(guildId));
}

export async function updateGuildConfig(
  guildId: string,
  updates: Partial<GuildConfigRecord>
): Promise<GuildConfigRecord> {
  return usePostgres
    ? postgresDb.updateGuildConfig(guildId, updates)
    : Promise.resolve(sqliteDb.updateGuildConfig(guildId, updates));
}

export async function getRaidGateState(guildId: string): Promise<RaidGateRecord> {
  return usePostgres
    ? postgresDb.getRaidGateState(guildId)
    : Promise.resolve(sqliteDb.getRaidGateState(guildId));
}

export async function setRaidGateState(
  guildId: string,
  gateActive: boolean,
  reason: string | null,
  gateUntil: string | null
): Promise<RaidGateRecord> {
  return usePostgres
    ? postgresDb.setRaidGateState(guildId, gateActive, reason, gateUntil)
    : Promise.resolve(sqliteDb.setRaidGateState(guildId, gateActive, reason, gateUntil));
}

export async function listWarningCounts(guildId: string, limit = 50): Promise<WarningRecord[]> {
  return usePostgres
    ? postgresDb.listWarningCounts(guildId, limit)
    : Promise.resolve(sqliteDb.listWarningCounts(guildId, limit));
}

export async function listTopLevelMembers(
  guildId: string,
  limit = 3
): Promise<Array<{ user_id: string; level: number; xp: number }>> {
  return usePostgres
    ? postgresDb.listTopLevelMembers(guildId, limit)
    : Promise.resolve(sqliteDb.listTopLevelMembers(guildId, limit));
}

export async function countTrackedLevelMembers(guildId: string): Promise<number> {
  return usePostgres
    ? postgresDb.countTrackedLevelMembers(guildId)
    : Promise.resolve(sqliteDb.countTrackedLevelMembers(guildId));
}

export async function listCommandToggles(guildId: string): Promise<CommandToggleRecord[]> {
  return usePostgres
    ? postgresDb.listCommandToggles(guildId)
    : Promise.resolve(sqliteDb.listCommandToggles(guildId));
}

export async function getCommandStates(guildId: string): Promise<CommandToggleRecord[]> {
  return usePostgres
    ? postgresDb.getCommandStates(guildId)
    : Promise.resolve(sqliteDb.getCommandStates(guildId));
}

export async function setCommandEnabled(
  guildId: string,
  commandName: string,
  enabled: boolean
): Promise<CommandToggleRecord> {
  return usePostgres
    ? postgresDb.setCommandEnabled(guildId, commandName, enabled)
    : Promise.resolve(sqliteDb.setCommandEnabled(guildId, commandName, enabled));
}

export async function getStaffTotpAuth(guildId: string, userId: string): Promise<TotpRecord | null> {
  return usePostgres
    ? postgresDb.getStaffTotpAuth(guildId, userId)
    : Promise.resolve(sqliteDb.getStaffTotpAuth(guildId, userId));
}

export async function upsertStaffTotpAuth(params: {
  guildId: string;
  userId: string;
  secretBase32: string;
  enabled?: boolean;
  lastVerifiedAt?: string | null;
}): Promise<TotpRecord> {
  return usePostgres
    ? postgresDb.upsertStaffTotpAuth(params)
    : Promise.resolve(sqliteDb.upsertStaffTotpAuth(params));
}

export async function markStaffTotpVerified(
  guildId: string,
  userId: string,
  verifiedAt?: string
): Promise<TotpRecord | null> {
  return usePostgres
    ? postgresDb.markStaffTotpVerified(guildId, userId, verifiedAt)
    : Promise.resolve(sqliteDb.markStaffTotpVerified(guildId, userId, verifiedAt));
}

export async function listReactionRolePanels(guildId: string): Promise<ReactionRolePanelRecord[]> {
  return usePostgres
    ? postgresDb.listReactionRolePanels(guildId)
    : Promise.resolve(sqliteDb.listReactionRolePanels(guildId));
}

export async function createReactionRolePanel(
  guildId: string,
  input: {
    channelId: string;
    messageId: string;
    content: string;
    mappings: Array<{
      emojiKey: string;
      emojiDisplay: string;
      roleId: string;
    }>;
    createdByUserId?: string | null;
  }
): Promise<ReactionRolePanelRecord> {
  return usePostgres
    ? postgresDb.createReactionRolePanel(guildId, input)
    : Promise.resolve(sqliteDb.createReactionRolePanel(guildId, input));
}

export async function deleteReactionRolePanel(guildId: string, messageId: string): Promise<boolean> {
  return usePostgres
    ? postgresDb.deleteReactionRolePanel(guildId, messageId)
    : Promise.resolve(sqliteDb.deleteReactionRolePanel(guildId, messageId));
}
