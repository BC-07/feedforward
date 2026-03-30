// API service layer — all backend calls go through here.
// The base URL is proxied via Next.js rewrites (next.config.ts),
// so we call /api/* which gets forwarded to the Go backend.

const API_BASE = "/api";

export interface ApiResponse<T = unknown> {
  retCode: string;
  message: string;
  data: T;
}

export interface UserData {
  id: string;
  name: string;
  email: string;
  sessionId?: string;
}

export interface AdminData {
  id: string;
  name: string;
  email: string;
  unit: string;
  isSuperAdmin?: boolean;
  sessionId?: string;
}

export interface SessionData {
  id: string;
  role: string;
  userId?: string;
  adminId?: string;
  superadminUsername?: string;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  reauthExpiresAt?: string;
}

export interface Admin {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  unit: string;
  isDisabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface FeedbackData {
  id: string;
  type: string;
  category: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  userId: string;
  userName: string;
  isAnonymous: boolean;
  response?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackModerationData {
  is_flagged: boolean;
  severity: "safe" | "warning" | "offensive";
  matched_words: string[];
  reason: string;
}

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  const json = await res.json();
  if (!res.ok) {
    // Throw the message from the backend response
    throw new Error(json.message || "Request failed");
  }
  return json as ApiResponse<T>;
}

function post<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  return request<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function put<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  return request<T>(path, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

function del<T>(path: string): Promise<ApiResponse<T>> {
  return request<T>(path, { method: "DELETE" });
}

function get<T>(path: string): Promise<ApiResponse<T>> {
  return request<T>(path, { method: "GET" });
}

// ===================== USER API =====================

export const registerUser = (data: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  termsAccepted: boolean;
}) => post<UserData>("/users/register", data);

export const loginUser = (data: { email: string; password: string }) =>
  post<UserData>("/users/login", data);

export const changeUserPassword = (data: {
  email: string;
  currentPassword: string;
  newPassword: string;
}) => post<{ success: boolean }>("/users/change-password", data);

export const forgotPassword = (data: { email: string }) =>
  post<{ sent: boolean }>("/users/forgot-password", data);

export const verifyResetOTP = (data: { email: string; otp: string }) =>
  post<{ verified: boolean; id: string; name: string; email: string; sessionId?: string }>("/users/verify-reset-otp", data);

export const logoutUser = () =>
  post<{ success: boolean }>("/users/logout", {});

// ===================== ADMIN API =====================

export const registerAdmin = (data: {
  adminKey: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  unit: string;
}) => post<AdminData>("/admins/register", data);

export const loginAdmin = (data: { email: string; password: string }) =>
  post<AdminData>("/admins/login", data);

export const setAdminPassword = (data: { token: string; newPassword: string }) =>
  post<{ success: boolean }>("/admins/set-password", data);

export const logoutAdmin = () =>
  post<{ success: boolean }>("/admins/logout", {});

export const updateAdminUnit = (adminId: string, unit: string) =>
  put<{ unit: string }>(`/admins/${adminId}/unit`, { unit });

// ===================== FEEDBACK API =====================

export const submitFeedback = (data: {
  type: string;
  category: string;
  priority: string;
  subject: string;
  message: string;
  userId: string;
  userName: string;
  isAnonymous: boolean;
}) => post<FeedbackData>("/feedbacks", data);

export const moderateFeedback = (data: {
  subject: string;
  message: string;
}) => post<FeedbackModerationData>("/feedbacks/moderate", data);

export const getFeedbackById = (id: string) =>
  get<FeedbackData>(`/feedbacks/${id}`);

export const getFeedbacksByUser = (userId: string) =>
  get<FeedbackData[]>(`/feedbacks/user/${userId}`);

export const getFeedbacksByUnit = (unit: string) =>
  get<FeedbackData[]>(`/feedbacks/unit/${encodeURIComponent(unit)}`);

export const updateFeedback = (
  id: string,
  data: { status?: string; priority?: string; response?: string },
) => put<FeedbackData>(`/feedbacks/${id}`, data);

export const deleteFeedback = (id: string) =>
  del<string>(`/feedbacks/${id}`);

// ===================== SUPERADMIN API =====================

async function requestWithToken<T>(
  path: string,
  superAdminId: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  const { headers: extraHeaders, ...restOptions } = options ?? {};
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...restOptions,
    headers: {
      "Content-Type": "application/json",
      "X-SuperAdmin-Id": superAdminId,
      ...(extraHeaders as Record<string, string>),
    },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || "Request failed");
  }
  return json as ApiResponse<T>;
}

export const listAdmins = async (superAdminId: string): Promise<Admin[]> => {
  const res = await requestWithToken<Admin[]>("/superadmin/admins", superAdminId, { method: "GET" });
  return res.data;
};

export const createAdminBySuperAdmin = (
  superAdminId: string,
  data: { firstName: string; lastName: string; email: string; unit: string },
) => requestWithToken<Admin>("/superadmin/admins", superAdminId, {
  method: "POST",
  body: JSON.stringify(data),
});

export const updateAdminBySuperAdmin = (
  superAdminId: string,
  id: string,
  data: { firstName: string; lastName: string; email: string; password: string; unit: string },
) => requestWithToken<Admin>(`/superadmin/admins/${id}`, superAdminId, {
  method: "PUT",
  body: JSON.stringify(data),
});

export const deleteAdminBySuperAdmin = (superAdminId: string, id: string) =>
  requestWithToken<string>(`/superadmin/admins/${id}`, superAdminId, { method: "DELETE" });

export const disableAdminBySuperAdmin = (superAdminId: string, id: string) =>
  requestWithToken<Admin>(`/superadmin/admins/${id}/disable`, superAdminId, { method: "PATCH" });

export const logoutSuperAdmin = () =>
  post<{ success: boolean }>("/superadmin/logout", {});

export const getCurrentSession = () =>
  get<SessionData>("/sessions/current");

// ===================== CATEGORY API =====================

export const listCategories = async (): Promise<Category[]> => {
  const res = await request<Category[]>("/superadmin/categories", { method: "GET" });
  return res.data;
};

export const createCategoryBySuperAdmin = async (
  superAdminId: string,
  data: { name: string },
): Promise<Category[]> => {
  const res = await requestWithToken<Category[]>("/superadmin/categories", superAdminId, {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.data;
};

export const updateCategoryBySuperAdmin = async (
  superAdminId: string,
  id: number,
  data: { name: string },
): Promise<Category[]> => {
  const res = await requestWithToken<Category[]>(`/superadmin/categories/${id}`, superAdminId, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return res.data;
};

export const deleteCategoryBySuperAdmin = async (
  superAdminId: string,
  id: number,
): Promise<Category[]> => {
  const res = await requestWithToken<Category[]>(`/superadmin/categories/${id}`, superAdminId, {
    method: "DELETE",
  });
  return res.data;
};
