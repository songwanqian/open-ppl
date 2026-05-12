"use client";

import { useSession } from "@/hooks/use-session";
import { GatewayModelsSection } from "./gateway-models-section";
import { GatewayModelVariantsSection } from "./gateway-model-variants-section";

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

export default function GatewayModelsPage() {
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
        <h1 className="text-2xl font-semibold">Gateway Models</h1>
        <p className="text-sm text-muted-foreground">
          Manage available models and built-in model variants. Only enabled
          models are visible to users.
        </p>
      </div>

      <GatewayModelsSection />

      <div className="border-t border-border/50" />

      <GatewayModelVariantsSection />
    </div>
  );
}
