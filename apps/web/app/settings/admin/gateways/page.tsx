"use client";

import { useSession } from "@/hooks/use-session";
import { GatewayAccountsSection } from "./gateway-accounts-section";

function NotFoundState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-4xl font-bold">404</p>
      <p className="mt-2 text-sm text-muted-foreground">
        This page could not be found.
      </p>
    </div>
  );
}

export default function GatewaysPage() {
  const { isAdmin, loading } = useSession();

  if (loading) {
    return null;
  }

  if (!isAdmin) {
    return <NotFoundState />;
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Gateway Accounts</h1>
        <p className="text-sm text-muted-foreground">
          Configure upstream model provider accounts. Models route through these
          gateway accounts to reach their upstream APIs.
        </p>
      </div>
      <GatewayAccountsSection />
    </div>
  );
}
