import { GET as oauthCallbackGet } from "@/app/oauth/callback/route";

export async function GET(request: Request) {
  return oauthCallbackGet(request);
}
