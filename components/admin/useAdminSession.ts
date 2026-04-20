"use client";

import { useEffect, useState } from "react";

const SESSION_EVENT = "feedforward:session-change";

export type AdminSessionInfo = {
  id: string;
  name: string;
  email: string;
  unit: string;
};

function readAdminSession(): AdminSessionInfo | null {
  if (typeof window === "undefined") return null;

  const isAdminLoggedIn = localStorage.getItem("isAdminLoggedIn") === "true";
  if (!isAdminLoggedIn) return null;

  const id = localStorage.getItem("currentAdminId") || "";
  const name = localStorage.getItem("currentAdminName") || "";
  const email = localStorage.getItem("currentAdminEmail") || "";
  const unit = localStorage.getItem("currentAdminDepartment") || "";

  if (!id || !unit) return null;

  return {
    id,
    name,
    email,
    unit,
  };
}

export function useAdminSession(): AdminSessionInfo | null {
  const [admin, setAdmin] = useState<AdminSessionInfo | null>(null);

  useEffect(() => {
    const syncSession = () => {
      setAdmin(readAdminSession());
    };

    syncSession();
    window.addEventListener("storage", syncSession);
    window.addEventListener(SESSION_EVENT, syncSession);

    return () => {
      window.removeEventListener("storage", syncSession);
      window.removeEventListener(SESSION_EVENT, syncSession);
    };
  }, []);

  return admin;
}
