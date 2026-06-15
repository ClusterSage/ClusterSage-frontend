"use client";
import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LogsPage({ params }: { params: Promise<{ clusterId: string }> }) {
  const { clusterId } = use(params);
  const router = useRouter();
  useEffect(() => { router.replace(`/dashboard/clusters/${clusterId}`); }, [clusterId, router]);
  return <div className="card">Opening resource logs...</div>;
}
