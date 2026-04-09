export const PERMISSION_ADMINISTRATOR = 1n << 3n;
export const PERMISSION_MANAGE_GUILD = 1n << 5n;
export const PERMISSION_MODERATE_MEMBERS = 1n << 40n;

export function hasStaffDashboardAccess(rawPermissions: string | number | bigint | null | undefined): boolean {
  if (rawPermissions === null || rawPermissions === undefined) {
    return false;
  }

  let value: bigint;
  try {
    value = BigInt(rawPermissions);
  } catch {
    return false;
  }

  if (value & PERMISSION_ADMINISTRATOR) {
    return true;
  }
  if (value & PERMISSION_MANAGE_GUILD) {
    return true;
  }
  if (value & PERMISSION_MODERATE_MEMBERS) {
    return true;
  }
  return false;
}
