import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import AdminDashboard from "@/components/Admin/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const admin = await db.user.findUnique({ where: { id: user.id }, select: { admin: true } });
  if (!admin?.admin) redirect("/channels/@me");
  return <AdminDashboard />;
}
