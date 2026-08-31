import { apiOk } from "@/lib/api-response";
import { listPlugins } from "@/lib/plugins";

export async function GET() {
  return apiOk({ plugins: listPlugins() });
}
