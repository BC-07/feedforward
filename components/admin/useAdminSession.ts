"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

export interface AdminSessionInfo {
  id: string;
  name: string;
  email: string;
  unit: string;
}

export function useAdminSession() {
  const router = useRouter();

  const currentAdmin = useMemo(() => {
    if (typeof window === "undefined") return null;
    if (!localStorage.getItem("isAdminLoggedIn")) return null;

    return {
      id: localStorage.getItem("currentAdminId") || "",
      name: localStorage.getItem("currentAdminName") || "",
      email: localStorage.getItem("currentAdminEmail") || "",
      unit: localStorage.getItem("currentAdminDepartment") || "",
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isLoggedIn = localStorage.getItem("isAdminLoggedIn");
    if (!isLoggedIn) {
      router.push("/login");
    }
  }, [router]);

  return currentAdmin;
}