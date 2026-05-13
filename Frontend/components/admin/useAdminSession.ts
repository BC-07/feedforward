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
    const rememberMe = localStorage.getItem("ffRememberMe") === "true";
    const storage = rememberMe ? localStorage : sessionStorage;
    if (storage.getItem("isAdminLoggedIn") !== "true") return null;

    return {
      id: storage.getItem("currentAdminId") || "",
      name: storage.getItem("currentAdminName") || "",
      email: storage.getItem("currentAdminEmail") || "",
      unit: storage.getItem("currentAdminDepartment") || "",
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rememberMe = localStorage.getItem("ffRememberMe") === "true";
    const storage = rememberMe ? localStorage : sessionStorage;

    const isLoggedIn = storage.getItem("isAdminLoggedIn");
    if (isLoggedIn !== "true") {
      router.push("/login");
    }
  }, [router]);

  return currentAdmin;
}
