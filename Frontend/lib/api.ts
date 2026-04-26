export interface Feedback {
  id: string;
  type: string;
  category: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  userId?: string | null;
  userName?: string;
  userEmail?: string;
  isAnonymous?: boolean;
  createdAt: string;
  updatedAt: string;
  response?: string | null;
}

export interface FeedbackMessage {
  id: string;
  feedbackId: string;
  senderRole: "user" | "admin" | "superadmin";
  senderId?: string | null;
  senderName: string;
  message: string;
  createdAt: string;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface Admin {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  unit: string;
  isDisabled?: boolean;
  isSuperAdmin?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SuperAdminSession {
  username: string;
  expiresAt: string;
}

export interface LoginRoleResponse {
  role: "none" | "user" | "admin" | "superadmin";
  isSuperAdmin?: boolean;
}

export interface Category {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface SuperAdminBarStatRow {
  label: string;
  count: number;
}

interface ApiResponse<T> {
  retCode: string;
  message: string;
  data: T;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:5566";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { headers: initHeaders, ...restInit } = init ?? {};

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(initHeaders || {}),
    },
    credentials: "include",
    ...restInit,
  });

  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok) {
    const errorMessage =
      typeof payload?.data === "object" &&
      payload?.data &&
      "message" in payload.data
        ? String(payload.data.message)
        : payload?.message || "Request failed";

    if (
      typeof window !== "undefined" &&
      (response.status === 401 || response.status === 403)
    ) {
      const lowerMessage = String(errorMessage || "").toLowerCase();
      const isSessionInvalid =
        lowerMessage.includes("session") ||
        lowerMessage.includes("expired") ||
        lowerMessage.includes("reauthentication required");
      const isAdminLoggedIn =
        localStorage.getItem("isAdminLoggedIn") === "true" ||
        localStorage.getItem("isSuperAdminLoggedIn") === "true";
      if (isAdminLoggedIn && isSessionInvalid) {
        localStorage.removeItem("isAdminLoggedIn");
        localStorage.removeItem("currentAdminId");
        localStorage.removeItem("currentAdminName");
        localStorage.removeItem("currentAdminEmail");
        localStorage.removeItem("currentAdminDepartment");
        localStorage.removeItem("isSuperAdminLoggedIn");
        localStorage.removeItem("superAdminName");
        localStorage.removeItem("superAdminExpiresAt");
        localStorage.setItem(
          "sessionExpiredMessage",
          "You were signed out due to inactivity. Please log in again.",
        );
        try {
          // Lazy import to avoid SSR issues.
          const { toast } = await import("sonner");
          toast.error("Your session expired due to inactivity. Please log in again.");
        } catch {
          // no-op
        }
        window.location.href = "/login";
      }
    }

    throw new Error(errorMessage);
  }

  return payload.data;
}

export async function listFeedbacks(filters?: {
  category?: string;
  userId?: string;
  search?: string;
  type?: string;
  status?: string;
  priority?: string;
}): Promise<Feedback[]> {
  const params = new URLSearchParams();

  if (filters?.category) {
    params.set("category", filters.category);
  }

  if (filters?.userId) {
    params.set("userId", filters.userId);
  }

  if (filters?.search) {
    params.set("search", filters.search);
  }

  if (filters?.type) {
    params.set("type", filters.type);
  }

  if (filters?.status) {
    params.set("status", filters.status);
  }

  if (filters?.priority) {
    params.set("priority", filters.priority);
  }

  const query = params.toString();
  const data = await apiFetch<Feedback[] | null>(
    `/feedbacks${query ? `?${query}` : ""}`,
  );
  return Array.isArray(data) ? data : [];
}

export async function getFeedback(id: string): Promise<Feedback> {
  return apiFetch<Feedback>(`/feedbacks/${encodeURIComponent(id)}`);
}

export async function createFeedback(
  payload: Omit<Feedback, "createdAt" | "updatedAt">,
): Promise<Feedback> {
  return apiFetch<Feedback>("/feedbacks", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function moderateFeedback(payload: {
  subject: string;
  message: string;
}): Promise<{
  is_flagged: boolean;
  severity: "safe" | "warning" | "offensive";
  matched_words: string[];
  reason: string;
}> {
  return apiFetch("/feedbacks/moderate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateFeedback(
  id: string,
  payload: Partial<Feedback>,
): Promise<Feedback> {
  return apiFetch<Feedback>(`/feedbacks/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteFeedback(id: string): Promise<void> {
  await apiFetch(`/feedbacks/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function listFeedbackMessages(
  feedbackId: string,
): Promise<FeedbackMessage[]> {
  const data = await apiFetch<FeedbackMessage[] | null>(
    `/feedbacks/${encodeURIComponent(feedbackId)}/messages`,
  );
  return Array.isArray(data) ? data : [];
}

export async function createFeedbackMessage(
  feedbackId: string,
  payload: { message: string },
): Promise<FeedbackMessage> {
  return apiFetch<FeedbackMessage>(
    `/feedbacks/${encodeURIComponent(feedbackId)}/messages`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function createFeedbackMessagePublic(
  feedbackId: string,
  payload: { message: string },
): Promise<FeedbackMessage> {
  const response = await fetch(
    `${API_BASE_URL}/feedbacks/${encodeURIComponent(feedbackId)}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "omit",
      body: JSON.stringify(payload),
    },
  );

  const payloadResponse = (await response.json()) as ApiResponse<FeedbackMessage>;
  if (!response.ok) {
    throw new Error(payloadResponse?.message || "Request failed");
  }

  return payloadResponse.data;
}

export async function registerUser(payload: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}): Promise<User> {
  return apiFetch<User>("/auth/users/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginUser(payload: {
  email: string;
  password: string;
}): Promise<User> {
  return apiFetch<User>("/auth/users/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function requestUserLoginOTP(payload: {
  email: string;
}): Promise<{ sent: boolean }> {
  return apiFetch<{ sent: boolean }>("/auth/users/login/request-otp", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function verifyUserLoginOTP(payload: {
  email: string;
  otp: string;
}): Promise<User> {
  return apiFetch<User>("/auth/users/login/verify-otp", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function forgotPassword(payload: {
  email: string;
}): Promise<{ sent: boolean }> {
  return apiFetch<{ sent: boolean }>("/auth/users/forgot-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function verifyResetOTP(payload: {
  email: string;
  otp: string;
}): Promise<{
  verified: boolean;
  role?: "user" | "admin";
}> {
  return apiFetch("/auth/users/verify-reset-otp", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function resetPassword(payload: {
  email: string;
  newPassword: string;
  role?: "user" | "admin";
}): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>("/auth/users/reset-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function setAdminPassword(payload: {
  token: string;
  newPassword: string;
}): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>("/auth/admins/set-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function registerAdmin(payload: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  unit: string;
}): Promise<Admin> {
  return apiFetch<Admin>("/auth/admins/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginAdmin(payload: {
  email: string;
  password: string;
}): Promise<Admin> {
  return apiFetch<Admin>("/auth/admins/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginSuperAdmin(payload: {
  username: string;
  password: string;
}): Promise<SuperAdminSession> {
  return apiFetch<SuperAdminSession>("/auth/superadmin/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getLoginRole(email: string): Promise<LoginRoleResponse> {
  const params = new URLSearchParams();
  params.set("email", email);
  return apiFetch<LoginRoleResponse>(`/auth/login-role?${params.toString()}`);
}

export async function listAdmins(): Promise<Admin[]> {
  const data = await apiFetch<Admin[] | null>("/superadmin/admins");
  return Array.isArray(data) ? data : [];
}

export async function getResolvedAdminsLast7Days(
  range: "1d" | "7d" | "30d" = "7d",
): Promise<SuperAdminBarStatRow[]> {
  const data = await apiFetch<SuperAdminBarStatRow[] | null>(
    `/superadmin/stats/resolved-admins?range=${encodeURIComponent(range)}`,
  );
  return Array.isArray(data) ? data : [];
}

export async function getCategorySubmissionsLast7Days(
  range: "1d" | "7d" | "30d" = "7d",
): Promise<SuperAdminBarStatRow[]> {
  const data = await apiFetch<SuperAdminBarStatRow[] | null>(
    `/superadmin/stats/submissions-categories?range=${encodeURIComponent(range)}`,
  );
  return Array.isArray(data) ? data : [];
}

export async function listCategories(): Promise<Category[]> {
  const data = await apiFetch<Category[] | null>("/categories");
  return Array.isArray(data) ? data : [];
}

export async function createCategoryBySuperAdmin(
  payload: { name: string },
): Promise<Category[]> {
  return apiFetch<Category[]>("/superadmin/categories", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCategoryBySuperAdmin(
  id: number,
  payload: { name: string },
): Promise<Category[]> {
  return apiFetch<Category[]>(`/superadmin/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteCategoryBySuperAdmin(
  id: number,
): Promise<Category[]> {
  return apiFetch<Category[]>(`/superadmin/categories/${id}`, {
    method: "DELETE",
  });
}

export async function createAdminBySuperAdmin(
  payload: {
    firstName: string;
    lastName: string;
    email: string;
    unit: string;
  },
): Promise<Admin> {
  return apiFetch<Admin>("/superadmin/admins", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAdminBySuperAdmin(
  id: string,
  payload: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    unit: string;
  }>,
): Promise<Admin> {
  return apiFetch<Admin>(`/superadmin/admins/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminBySuperAdmin(
  id: string,
): Promise<void> {
  await apiFetch(`/superadmin/admins/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function disableAdminBySuperAdmin(
  id: string,
): Promise<Admin> {
  return apiFetch<Admin>(`/superadmin/admins/${encodeURIComponent(id)}/disable`, {
    method: "PUT",
  });
}

export async function enableAdminBySuperAdmin(
  id: string,
): Promise<Admin> {
  return apiFetch<Admin>(`/superadmin/admins/${encodeURIComponent(id)}/enable`, {
    method: "PUT",
  });
}

export async function reverifyAdmin(password: string): Promise<void> {
  await apiFetch("/auth/admins/reverify", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function reverifySuperAdmin(password: string): Promise<void> {
  await apiFetch("/auth/superadmin/reverify", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function logout(): Promise<void> {
  await apiFetch("/auth/logout", { method: "POST" });
}

export async function getSessionMe(): Promise<{
  role: string;
  userId?: string | null;
  adminId?: string | null;
  lastActivityAt?: string;
  expiresAt?: string;
}> {
  return apiFetch("/auth/session");
}

export async function pingSuperAdminSession(): Promise<{
  role: string;
  adminId?: string | null;
  lastActivityAt?: string;
  expiresAt?: string;
}> {
  return apiFetch("/auth/superadmin/ping", { method: "POST" });
}

export async function updateUserProfile(
  id: string,
  payload: { firstName: string; lastName: string },
): Promise<User> {
  return apiFetch<User>(`/auth/users/${encodeURIComponent(id)}/profile`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function updateUserPassword(
  id: string,
  payload: { currentPassword: string; newPassword: string },
): Promise<void> {
  await apiFetch(`/auth/users/${encodeURIComponent(id)}/password`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteUserAccount(id: string): Promise<void> {
  await apiFetch(`/auth/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function updateAdminPassword(
  id: string,
  payload: { currentPassword: string; newPassword: string },
): Promise<void> {
  await apiFetch(`/auth/admins/${encodeURIComponent(id)}/password`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminAccount(id: string): Promise<void> {
  await apiFetch(`/auth/admins/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function updateAdminProfile(
  id: string,
  payload: { firstName: string; lastName: string },
): Promise<Admin> {
  return apiFetch<Admin>(`/auth/admins/${encodeURIComponent(id)}/profile`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

