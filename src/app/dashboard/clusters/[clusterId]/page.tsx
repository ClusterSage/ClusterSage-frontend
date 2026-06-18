import { redirect } from "next/navigation";

export default async function ClusterRedirectPage({
  params,
}: {
  params: Promise<{ clusterId: string }>;
}) {
  const { clusterId } = await params;
  redirect(`/dashboard/clusters/${clusterId}/dashboard`);
}
