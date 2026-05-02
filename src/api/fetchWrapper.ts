import { triggerUnauthorized } from "@/utils/authEvents";

const LOGIN_PATH = "/auth/login";

export const wrappedFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (response.status === 401) {
    const url = typeof input === "string" ? input : input instanceof Request ? input.url : "";
    if (!url.includes(LOGIN_PATH)) {
      triggerUnauthorized();
    }
  }
  return response;
};
