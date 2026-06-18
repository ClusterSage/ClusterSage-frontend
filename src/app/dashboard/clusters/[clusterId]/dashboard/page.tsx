import { ClusterWorkspaceView } from "@/components/clusters/ClusterWorkspaceView";

export default async function ClusterDashboardPage({
  params,
}: {
  params: Promise<{ clusterId: string }>;
}) {
  const { clusterId } = await params;
  return <ClusterWorkspaceView clusterId={clusterId} view="dashboard" />;
}
