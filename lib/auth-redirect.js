const DEFAULT_AUTH_REDIRECT = "/dashboard";

function getSafePathname(pathname) {
  if (!pathname || pathname === "/") {
    return DEFAULT_AUTH_REDIRECT;
  }

  if (!pathname.startsWith("/") || pathname.startsWith("//") || pathname.startsWith("/login")) {
    return null;
  }

  return pathname;
}

export function getSafeNextPath(candidate, origin) {
  if (!candidate || typeof candidate !== "string") {
    return null;
  }

  const trimmed = candidate.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("/")) {
    return getSafePathname(trimmed);
  }

  if (!origin) {
    return null;
  }

  try {
    const url = new URL(trimmed);

    if (url.origin !== origin) {
      return null;
    }

    return getSafePathname(`${url.pathname}${url.search}${url.hash}`);
  } catch {
    return null;
  }
}

export function getLoginRedirectTarget(candidate, origin) {
  return getSafeNextPath(candidate, origin) ?? DEFAULT_AUTH_REDIRECT;
}
