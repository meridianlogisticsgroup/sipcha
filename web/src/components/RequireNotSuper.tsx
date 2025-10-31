import React, { useEffect, useState } from "react";
import { api } from "../auth";
import { Navigate } from "react-router-dom";

export default function RequireNotSuper({ children }: { children: React.ReactNode }) {
  const [isSuper, setIsSuper] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("/me");
        setIsSuper((r.data?.roles || []).includes("superadmin"));
      } catch {
        setIsSuper(false);
      }
    })();
  }, []);

  if (isSuper === null) return null; // could add a spinner here
  if (isSuper) return <Navigate to="/admin-users" replace />;
  return <>{children}</>;
}
