import { ClusterShell } from "@/components/ClusterShell";

export default async function ClusterLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clusterId: string }>;
}) {
  const { clusterId } = await params;
  return <ClusterShell clusterId={clusterId}>{children}</ClusterShell>;
}
