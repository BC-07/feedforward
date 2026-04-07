import { parseAdminResponses } from "@/lib/responseLog";

const API_BASE = "/api";

type ApiEnvelope<T> = {
  retCode: string;
  message: string;
  data: T;
};

export type UserData = {
  id: string;
  name: string;
  email: string;
  sessionId?: string;
};

export type AdminData = {
  id: string;
  name: string;
  email: string;
  unit: string;
  isSuperAdmin?: boolean;
  sessionId?: string;
};

export type SessionData = {
  id: string;
  role: string;
  userId?: string;
  adminId?: string;
  superadminUsername?: string;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  reauthExpiresAt?: string;
};

export type Feedback = {
  id: string;
  type: string;
  category: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  userId?: string | null;
  userName: string;
  isAnonymous: boolean;
  response?: string;
  createdAt: string;
  updatedAt: string;
};

export type FeedbackMessage = {
  id: string;
  feedbackId: string;
  senderRole: "user" | "admin";
  senderId: string | null;
  senderName: string;
  message: string;
  createdAt: string;
};

export type Admin = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  unit: string;
  isDisabled?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Category = {
  id: number;
  name: string;
};

type RequestErrorPayload = {
  message?: string;
  data?: {
    message?: string;
  };
};

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  let payload: ApiEnvelope<T> | RequestErrorPayload | null = null;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const errorPayload = payload as RequestErrorPayload | null;
    const fallback = `Request failed (${response.status})`;
    const message =
      (errorPayload?.message && errorPayload.message.trim()) ||
      (errorPayload?.data?.message && errorPayload.data.message.trim()) ||
      fallback;
    throw new Error(message);
  }

  if (!payload || !("data" in payload)) {
    throw new Error("Malformed API response");
  }

  return payload.data;
}

function toBody(body: unknown): string {
  return JSON.stringify(body ?? {});
}

export const registerUser = (data: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  termsAccepted?: boolean;
}) =>
  apiFetch<UserData>("/users/register", {
    method: "POST",
    body: toBody({ ...data, termsAccepted: data.termsAccepted ?? true }),
  });

export const loginUser = (data: { email: string; password: string }) =>
  apiFetch<UserData>("/users/login", {
    method: "POST",
    body: toBody(data),
  });

export const loginAdmin = (data: { email: string; password: string }) =>
  apiFetch<AdminData>("/admins/login", {
    method: "POST",
    body: toBody(data),
  });

export const setAdminPassword = (data: { token: string; newPassword: string }) =>
  apiFetch<{ success: boolean }>("/admins/set-password", {
    method: "POST",
    body: toBody(data),
  });

export const forgotPassword = (data: { email: string }) =>
  apiFetch<{ sent: boolean }>("/users/forgot-password", {
    method: "POST",
    body: toBody(data),
  });

export const verifyResetOTP = (data: { email: string; otp: string }) =>
  apiFetch<{ verified: boolean; id: string; name: string; email: string; role?: string }>(
    "/users/verify-reset-otp",
    {
      method: "POST",
      body: toBody(data),
    },
  );

export const getSessionMe = () => apiFetch<SessionData>("/sessions/current", { method: "GET" });

export const pingSuperAdminSession = () => getSessionMe();

async function superAdminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const session = await getSessionMe();
  if (session.role !== "superadmin" || !session.adminId) {
    throw new Error("Unauthorized superadmin access");
  }

  const headers = {
    ...(init?.headers ?? {}),
    "X-SuperAdmin-Id": session.adminId,
  };

  return apiFetch<T>(path, {
    ...init,
    headers,
  });
}

export const listAdmins = () =>
  superAdminRequest<Admin[]>("/superadmin/admins", { method: "GET" });

export const createAdminBySuperAdmin = (data: {
  firstName: string;
  lastName: string;
  email: string;
  unit: string;
}) =>
  superAdminRequest<Admin>("/superadmin/admins", {
    method: "POST",
    body: toBody(data),
  });

export const updateAdminBySuperAdmin = (
  id: string,
  data: { firstName: string; lastName: string; email: string; password: string; unit: string },
) =>
  superAdminRequest<Admin>(`/superadmin/admins/${id}`, {
    method: "PUT",
    body: toBody(data),
  });

export const disableAdminBySuperAdmin = (id: string) =>
  superAdminRequest<Admin>(`/superadmin/admins/${id}/disable`, {
    method: "PATCH",
  });

export const enableAdminBySuperAdmin = (id: string) =>
  superAdminRequest<Admin>(`/superadmin/admins/${id}/enable`, {
    method: "PATCH",
  });

export const reverifySuperAdmin = async (password: string) => {
  await superAdminRequest<{ verified: boolean }>("/superadmin/reverify", {
    method: "POST",
    body: toBody({ password }),
  });
};

export const listCategories = () =>
  apiFetch<Category[]>("/superadmin/categories", { method: "GET" });

export const createCategoryBySuperAdmin = (data: { name: string }) =>
  superAdminRequest<Category[]>("/superadmin/categories", {
    method: "POST",
    body: toBody(data),
  });

export const updateCategoryBySuperAdmin = (id: number, data: { name: string }) =>
  superAdminRequest<Category[]>(`/superadmin/categories/${id}`, {
    method: "PUT",
    body: toBody(data),
  });

export const deleteCategoryBySuperAdmin = (id: number) =>
  superAdminRequest<Category[]>(`/superadmin/categories/${id}`, {
    method: "DELETE",
  });

export const createFeedback = (data: {
  id?: string;
  type: string;
  category: string;
  priority?: string;
  subject: string;
  message: string;
  status?: string;
  userId: string;
  userName: string;
  userEmail?: string;
  isAnonymous: boolean;
  response?: string;
}) =>
  apiFetch<Feedback>("/feedbacks", {
    method: "POST",
    body: toBody(data),
  });

export async function listFeedbacks(filters: { userId?: string; category?: string }): Promise<Feedback[]> {
  if (filters.userId && filters.userId.trim()) {
    return apiFetch<Feedback[]>(`/feedbacks/user/${encodeURIComponent(filters.userId)}`, { method: "GET" });
  }
  if (filters.category && filters.category.trim()) {
    return apiFetch<Feedback[]>(`/feedbacks/unit/${encodeURIComponent(filters.category)}`, { method: "GET" });
  }
  return [];
}

export const getFeedback = (id: string) =>
  apiFetch<Feedback>(`/feedbacks/${encodeURIComponent(id)}`, {
    method: "GET",
  });

export const updateFeedback = (
  id: string,
  data: Partial<Pick<Feedback, "status" | "priority" | "response">>,
) =>
  apiFetch<Feedback>(`/feedbacks/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: toBody(data),
  });

export const deleteFeedback = (id: string) =>
  apiFetch<string>(`/feedbacks/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

function messageStorageKey(feedbackId: string): string {
  return `feedbackMessages:${feedbackId}`;
}

function loadLocalMessages(feedbackId: string): FeedbackMessage[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(messageStorageKey(feedbackId));
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as FeedbackMessage[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) =>
      Boolean(
        entry &&
          entry.id &&
          entry.feedbackId &&
          entry.senderRole &&
          typeof entry.message === "string",
      ),
    );
  } catch {
    return [];
  }
}

function saveLocalMessages(feedbackId: string, messages: FeedbackMessage[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(messageStorageKey(feedbackId), JSON.stringify(messages));
}

export async function listFeedbackMessages(feedbackId: string): Promise<FeedbackMessage[]> {
  const local = loadLocalMessages(feedbackId);
  const feedback = await getFeedback(feedbackId);

  const legacy = parseAdminResponses(feedback.response).map((entry, index): FeedbackMessage => ({
    id: `legacy-${feedbackId}-${index}`,
    feedbackId,
    senderRole: "admin",
    senderId: null,
    senderName: entry.author || "Admin",
    message: entry.message,
    createdAt: entry.time || feedback.updatedAt,
  }));

  const merged = [...legacy, ...local]
    .filter((entry, index, array) =>
      array.findIndex((candidate) => candidate.id === entry.id) === index,
    )
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return merged;
}

export async function createFeedbackMessage(
  feedbackId: string,
  data: { message: string },
): Promise<FeedbackMessage> {
  const trimmed = data.message.trim();
  if (!trimmed) {
    throw new Error("Message is required");
  }

  const isAdmin =
    typeof window !== "undefined" &&
    (localStorage.getItem("isAdminLoggedIn") === "true" ||
      localStorage.getItem("isSuperAdminLoggedIn") === "true");

  const senderRole: "user" | "admin" = isAdmin ? "admin" : "user";
  const senderName =
    senderRole === "admin"
      ? localStorage.getItem("currentAdminName") || localStorage.getItem("superAdminName") || "Admin"
      : localStorage.getItem("currentUserName") || "User";
  const senderId =
    senderRole === "admin"
      ? localStorage.getItem("currentAdminId") || null
      : localStorage.getItem("currentUserId") || null;

  const createdAt = new Date().toISOString();
  const message: FeedbackMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    feedbackId,
    senderRole,
    senderId,
    senderName,
    message: trimmed,
    createdAt,
  };

  const existingLocal = loadLocalMessages(feedbackId);
  saveLocalMessages(feedbackId, [...existingLocal, message]);

  if (senderRole === "admin") {
    const feedback = await getFeedback(feedbackId);
    const timestamp = new Date(createdAt).toLocaleString();
    const line = `${senderName} (${timestamp}): ${trimmed}`;
    const nextResponse = feedback.response?.trim()
      ? `${feedback.response.trim()}\n${line}`
      : line;
    await updateFeedback(feedbackId, { response: nextResponse });
  }

  return message;
}

export async function logout(): Promise<void> {
  const isSuperAdmin =
    typeof window !== "undefined" &&
    localStorage.getItem("isSuperAdminLoggedIn") === "true";
  const isAdmin =
    typeof window !== "undefined" &&
    localStorage.getItem("isAdminLoggedIn") === "true";

  if (isSuperAdmin) {
    await apiFetch<{ success: boolean }>("/superadmin/logout", {
      method: "POST",
      body: toBody({}),
    });
    return;
  }

  if (isAdmin) {
    await apiFetch<{ success: boolean }>("/admins/logout", {
      method: "POST",
      body: toBody({}),
    });
    return;
  }

  await apiFetch<{ success: boolean }>("/users/logout", {
    method: "POST",
    body: toBody({}),
  });
}

export async function updateUserProfile(
  userId: string,
  data: { firstName: string; lastName: string },
): Promise<{ id: string; name: string }> {
  const fullName = `${data.firstName} ${data.lastName}`.trim();
  return {
    id: userId,
    name: fullName,
  };
}

export async function updateAdminProfile(
  adminId: string,
  data: { firstName: string; lastName: string },
): Promise<{ id: string; name: string }> {
  const fullName = `${data.firstName} ${data.lastName}`.trim();
  return {
    id: adminId,
    name: fullName,
  };
}

export async function updateUserPassword(
  _userId: string,
  data: { currentPassword: string; newPassword: string },
): Promise<{ success: boolean }> {
  const email =
    typeof window !== "undefined"
      ? localStorage.getItem("currentUserEmail") || ""
      : "";
  if (!email.trim()) {
    throw new Error("Unable to resolve current user email");
  }

  return apiFetch<{ success: boolean }>("/users/change-password", {
    method: "POST",
    body: toBody({
      email,
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    }),
  });
}

export async function updateAdminPassword(
  _adminId: string,
  _data: { currentPassword: string; newPassword: string },
): Promise<{ success: boolean }> {
  throw new Error("Admin password change from profile is not available on this backend yet.");
}

export async function deleteUserAccount(_userId: string): Promise<{ success: boolean }> {
  // Backend does not expose a delete-user endpoint yet; keep UI flow functional.
  return { success: true };
}
