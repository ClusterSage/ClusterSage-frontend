import { ClusterLimitsView } from "@/components/clusters/ClusterLimitsView";

export default async function ClusterLimitsPage({
  params,
  searchParams,
}: {
  params: Promise<{ clusterId: string }>;
  searchParams: Promise<{ metric?: string }>;
}) {
  const { clusterId } = await params;
  const { metric } = await searchParams;
  return <ClusterLimitsView clusterId={clusterId} requestedMetric={metric} />;
}
