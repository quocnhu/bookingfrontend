type GuideLike =
  | {
      guideProfile?: { type?: string | null } | null;
    }
  | null
  | undefined;

type DriverLike =
  | {
      driverProfile?: { type?: string | null } | null;
      provider?: { name?: string | null; isCompany?: boolean | null } | null;
    }
  | null
  | undefined;

type ProviderLike =
  | { name?: string | null; isCompany?: boolean | null }
  | null
  | undefined;

export function guideSourceLabel(guide: GuideLike): string | null {
  const type = guide?.guideProfile?.type;
  if (type === "OFFICIAL") return "Company";
  if (type === "FREELANCE") return "Freelance";
  return null;
}

export function driverSourceLabel(
  driver: DriverLike,
  assignmentProvider?: ProviderLike,
): string | null {
  const provider = driver?.provider ?? assignmentProvider;
  if (provider?.name) {
    return provider.isCompany === false
      ? `Outsourced · ${provider.name}`
      : `Company · ${provider.name}`;
  }
  if (driver?.driverProfile?.type === "FREELANCE") return "Freelance";
  if (driver?.driverProfile?.type === "COMPANY") return "Company";
  return null;
}

export function isExternalProvider(provider: ProviderLike): boolean {
  return !!provider?.name && provider.isCompany === false;
}

export function providerSourceLabel(provider: ProviderLike): string {
  if (!provider?.name) return "Company fleet";
  return isExternalProvider(provider)
    ? `Outsourced · ${provider.name}`
    : `Company · ${provider.name}`;
}

export function providerTagLabel(provider: ProviderLike): string | null {
  if (!provider?.name) return null;
  return isExternalProvider(provider)
    ? `TRANSPORT PROVIDER · ${provider.name}`
    : `COMPANY FLEET · ${provider.name}`;
}
