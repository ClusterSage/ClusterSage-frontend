import { ClusterWorkspaceView } from "@/components/clusters/ClusterWorkspaceView";

export default async function ClusterResourcesPage({
  params,
}: {
  params: Promise<{ clusterId: string }>;
}) {
  const { clusterId } = await params;
  return <ClusterWorkspaceView clusterId={clusterId} view="resources" />;
}
